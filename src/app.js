const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { PORT } = require("./config/env");

const authRoutes = require("./routes/auth.routes");
const memberRoutes = require("./routes/members.routes");
const contribRoutes = require("./routes/contributions.routes");
const donationRoutes = require("./routes/donations.routes");
const expenseRoutes = require("./routes/expenses.routes");
const reportRoutes = require("./routes/reports.routes");
const yearRoutes = require("./routes/year.routes");
const historyRoutes = require("./routes/history.routes");
const cycleRoutes = require("./routes/cycle.routes");
const weeklyRoutes = require("./routes/weekly.routes");

const app = express(); // ✅ THIS WAS MISSING

/* ================= CORS ================= */
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

/* ================= DB ================= */
connectDB();

/* ================= ROUTES ================= */
app.use("/api/auth", authRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/contributions", contribRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/years", yearRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/cycles", cycleRoutes);
app.use("/api/weekly", weeklyRoutes);

/* ================= ROOT ================= */
app.get("/", (req, res) => {
  res.send("Saraswati Club Backend");
});

module.exports = { app, PORT };
