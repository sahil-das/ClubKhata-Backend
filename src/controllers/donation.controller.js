const Donation = require("../models/Donation");
const FestivalYear = require("../models/FestivalYear");
const { logAction } = require("../utils/auditLogger");
const { toClient } = require("../utils/mongooseMoney"); // 👈 IMPORT THIS

/**
 * @route POST /api/v1/donations
 * @desc Add a new public donation
 */
exports.addDonation = async (req, res) => {
  try {
    const { donorName, amount, address, phone, date, receiptNo } = req.body;
    const { clubId, id: userId } = req.user;

    // 1. Validate Input
    if (!donorName || typeof donorName !== "string" || !donorName.trim()) {
      return res.status(400).json({ message: "Donor name is required" });
    }
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ message: "Valid positive amount is required" });
    }

    // 2. Find Active Year
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(400).json({ message: "No active festival year found." });

    // 3. Create Donation
    const donation = await Donation.create({
      club: clubId,
      year: activeYear._id,
      donorName: donorName.trim(),
      amount: Number(amount), // Input is Rupees (50) -> Saved as Paisa (5000)
      address: address?.trim(),
      phone: phone?.trim(),
      receiptNo: receiptNo?.trim(),
      date: date ? new Date(date) : new Date(),
      collectedBy: userId
    });

    // 4. Log Action
    await logAction({
      req,
      action: "DONATION_RECEIVED",
      target: `Donor: ${donation.donorName}`,
      details: { 
        donationId: donation._id,
        amount: Number(amount), 
        receipt: donation.receiptNo 
      }
    });

    // 💰 FIX: Convert to Plain Object & Format Amount to "50.00"
    const donationObj = donation.toObject();
    donationObj.amount = toClient(donation.get('amount', null, { getters: false }));

    res.status(201).json({ success: true, message: "Donation added", data: donationObj });
  } catch (err) {
    console.error("Add Donation Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @route GET /api/v1/donations
 * @desc Get donations for the ACTIVE year
 */
exports.getDonations = async (req, res) => {
  try {
    const { clubId } = req.user;
    
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    
    if (!activeYear) return res.json({ success: true, data: [] });

    const donations = await Donation.find({ club: clubId, year: activeYear._id })
      .populate("collectedBy", "name")
      .sort({ date: -1 });

    // 💰 FIX: Map and Format Every Item
    const formattedDonations = donations.map(d => {
        const obj = d.toObject();
        // Get raw integer (5000) -> Convert to client string ("50.00")
        obj.amount = toClient(d.get('amount', null, { getters: false }));
        return obj;
    });

    res.json({ success: true, data: formattedDonations });
  } catch (err) {
    console.error("Get Donations Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @route DELETE /api/v1/donations/:id
 * @desc Delete a donation entry
 */
exports.deleteDonation = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find first to log it
    const donation = await Donation.findOne({ _id: id, club: req.user.clubId });

    if (!donation) return res.status(404).json({ message: "Donation not found" });

    await Donation.findByIdAndDelete(id);

    // ✅ LOG DELETION
    await logAction({
      req,
      action: "DONATION_DELETED",
      target: `Deleted Donation: ${donation.donorName}`,
      details: { 
        amount: donation.amount, // Logging the string/getter value is fine here
        receipt: donation.receiptNo
      }
    });

    res.json({ success: true, message: "Donation deleted successfully" });
  } catch (err) {
    console.error("Delete Donation Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};