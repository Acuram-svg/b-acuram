require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@gadgetgalore.ph").toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@12345";
const MODERN_TECH_PRODUCTS = [
  {
    name: "NeuralPods Pro",
    category: "Audio",
    price: 10499,
    desc: "AI noise-canceling wireless earbuds with adaptive sound and all-day battery.",
    specs: "Bluetooth 5.4, 36-hour battery, IPX5 water resistance",
    image:
      "https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "SkyFold X1",
    category: "Mobile",
    price: 71999,
    desc: "Foldable flagship smartphone with immersive display and AI-powered camera system.",
    specs: "7.8-inch AMOLED, 512GB storage, 5G",
    image:
      "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "VisionTab 12",
    category: "Computing",
    price: 48999,
    desc: "Creator tablet with precision stylus and high-color-accuracy display.",
    specs: "12-inch 120Hz screen, 256GB, stylus included",
    image:
      "https://images.unsplash.com/photo-1589739900243-4b52cd9dd2f5?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "PulseWatch 9",
    category: "Wearables",
    price: 18999,
    desc: "Health-focused smartwatch with ECG, sleep tracking, and coaching insights.",
    specs: "AMOLED display, ECG sensor, GPS + LTE",
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "HomeMind Hub",
    category: "Smart Home",
    price: 11999,
    desc: "Central smart home controller for lights, cameras, speakers, and routines.",
    specs: "Voice assistant, multi-protocol support, app control",
    image:
      "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "AeroCam 4K Mini",
    category: "Photography",
    price: 24999,
    desc: "Pocket action camera designed for creators on the move.",
    specs: "4K 60fps, image stabilization, waterproof housing",
    image:
      "https://images.unsplash.com/photo-1512790182412-b19e6d62bc39?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "ClearView AR Glasses",
    category: "AR/VR",
    price: 45999,
    desc: "Lightweight AR glasses for notifications, maps, and immersive overlays.",
    specs: "Micro-OLED display, spatial audio, gesture control",
    image:
      "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "CoreConsole Neo",
    category: "Gaming",
    price: 29999,
    desc: "Next-gen console designed for high refresh-rate competitive gaming.",
    specs: "Ray tracing, 1TB SSD, 4K output",
    image:
      "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=900&q=80",
  },
];

// Middleware
app.use(cors());
app.use(bodyParser.json());

const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use("/uploads", express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const safeExt = extension || ".jpg";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// MongoDB Connection
const MONGO_URI =
  process.env.ATLAS_URI ||
  process.env.MONGO_URI ||
  "mongodb+srv://<username>:<password>@cluster0.mongodb.net/myDatabase";

// Schema & Model
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  role: { type: String, enum: ["customer", "admin"], default: "customer" },
  password: { type: String, required: true, select: false },
}, { timestamps: true });

const AppSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  desc: { type: String, required: true, trim: true },
  specs: { type: String, required: true, trim: true },
  image: { type: String, required: true, trim: true },
}, { timestamps: true });

const OrderSchema = new mongoose.Schema({
  customerName: { type: String, required: true, trim: true },
  customerEmail: { type: String, required: true, trim: true, lowercase: true },
  customerPhone: { type: String, required: true, trim: true },
  customerLocation: { type: String, required: true, trim: true },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "AppItem", required: true },
      name: { type: String, required: true },
      price: { type: Number, required: true, min: 0 },
      quantity: { type: Number, required: true, min: 1 },
      image: { type: String, required: true },
    }
  ],
  totalAmount: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ["pending", "processing", "completed", "cancelled"],
    default: "pending",
  },
}, { timestamps: true });

const User = mongoose.model("User", UserSchema);
const AppItem = mongoose.model("AppItem", AppSchema);
const Order = mongoose.model("Order", OrderSchema);

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function createAuthToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function requireAuth(req, res, next) {
  const authorization = req.header("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!token) {
    return res.status(401).json({ error: "Authentication token is required." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Only admin users can perform this action." });
  }
  next();
}

async function seedAdminUser() {
  try {
    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL }).select("+password");
    if (existingAdmin) {
      if (existingAdmin.role !== "admin") {
        existingAdmin.role = "admin";
      }
      if (!existingAdmin.password) {
        existingAdmin.password = await bcrypt.hash(ADMIN_PASSWORD, 10);
      }
      await existingAdmin.save();
      return;
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await User.create({
      name: "System Admin",
      email: ADMIN_EMAIL,
      role: "admin",
      password: hashedPassword,
    });

    console.log("Seeded admin account:");
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
  } catch (err) {
    console.error("Admin seeding error:", err.message);
  }
}

async function seedModernTechProducts() {
  try {
    const productCount = await AppItem.countDocuments();
    if (productCount > 0) {
      console.log(`Product seeding skipped (${productCount} existing product(s)).`);
      return;
    }

    await AppItem.insertMany(MODERN_TECH_PRODUCTS);
    console.log(`Seeded ${MODERN_TECH_PRODUCTS.length} modern tech products.`);
  } catch (err) {
    console.error("Product seeding error:", err.message);
  }
}

async function initializeDatabase() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB Connected");
    await seedAdminUser();
    await seedModernTechProducts();
  } catch (err) {
    console.error("MongoDB Connection Error:", err.message);
  }
}

initializeDatabase();

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "Backend is live. Use /api/apps for products.",
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "healthy" });
});

// ===== Auth Routes =====
app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!name || !normalizedEmail || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  try {
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: "Email already exists." });
    }

    const newUser = new User({
      name,
      email: normalizedEmail,
      role: "customer",
      password: await bcrypt.hash(password, 10),
    });
    await newUser.save();

    const safeUser = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    };
    const token = createAuthToken(newUser);
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/signin", async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  try {
    const user = await User.findOne({ email: normalizedEmail }).select("+password");
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const safeUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    const token = createAuthToken(user);
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Apps CRUD =====
app.get("/api/apps", async (req, res) => {
  try {
    const apps = await AppItem.find().sort({ createdAt: -1 });
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/apps", requireAuth, requireAdmin, async (req, res) => {
  upload.single("image")(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ error: uploadErr.message || "Image upload failed." });
    }

    try {
      const imagePath = req.file ? `/uploads/${req.file.filename}` : "";
      if (!imagePath) {
        return res.status(400).json({ error: "Product image is required." });
      }

      const appItem = new AppItem({
        name: req.body.name,
        category: req.body.category,
        price: req.body.price,
        desc: req.body.desc,
        specs: req.body.specs,
        image: imagePath,
      });
      await appItem.save();
      res.json(appItem);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

app.put("/api/apps/:id", requireAuth, requireAdmin, async (req, res) => {
  upload.single("image")(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ error: uploadErr.message || "Image upload failed." });
    }

    try {
      const existingApp = await AppItem.findById(req.params.id);
      if (!existingApp) {
        return res.status(404).json({ error: "App not found." });
      }

      const imagePath = req.file
        ? `/uploads/${req.file.filename}`
        : (req.body.existingImage || existingApp.image);

      const updatedApp = await AppItem.findByIdAndUpdate(
        req.params.id,
        {
          name: req.body.name,
          category: req.body.category,
          price: req.body.price,
          desc: req.body.desc,
          specs: req.body.specs,
          image: imagePath,
        },
        { new: true, runValidators: true }
      );

      res.json(updatedApp);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

app.delete("/api/apps/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const deletedApp = await AppItem.findByIdAndDelete(req.params.id);
    if (!deletedApp) {
      return res.status(404).json({ error: "App not found." });
    }
    res.json({ message: "App deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Orders =====
app.post("/api/orders", async (req, res) => {
  const {
    customerName,
    customerEmail,
    customerPhone,
    customerLocation,
    items
  } = req.body;

  if (!customerName || !customerEmail || !customerPhone || !customerLocation) {
    return res.status(400).json({ error: "Customer name, email, phone, and location are required." });
  }

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: "Cart items are required." });
  }

  try {
    const requestedIds = items.map((item) => item.productId).filter(Boolean);
    const productDocs = await AppItem.find({ _id: { $in: requestedIds } });
    const productMap = new Map(productDocs.map((product) => [product._id.toString(), product]));

    const orderItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const product = productMap.get(String(item.productId));
      const quantity = Number(item.quantity || 1);
      if (!product || quantity < 1) continue;

      orderItems.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity,
        image: product.image,
      });
      totalAmount += product.price * quantity;
    }

    if (!orderItems.length) {
      return res.status(400).json({ error: "No valid products found in cart." });
    }

    const newOrder = await Order.create({
      customerName,
      customerEmail: normalizeEmail(customerEmail),
      customerPhone,
      customerLocation,
      items: orderItems,
      totalAmount,
      status: "pending",
    });

    res.json(newOrder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/orders", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/orders/:id/status", requireAuth, requireAdmin, async (req, res) => {
  const { status } = req.body;
  const allowed = new Set(["pending", "processing", "completed", "cancelled"]);
  if (!allowed.has(status)) {
    return res.status(400).json({ error: "Invalid status value." });
  }

  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!updatedOrder) {
      return res.status(404).json({ error: "Order not found." });
    }
    res.json(updatedOrder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
