const FestivalYear = require("../models/FestivalYear");
const Club = require("../models/Club");

/**
 * @route PUT /api/v1/years/:id
 * @desc Update Active Year Settings
 */
exports.updateYear = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent modifying 'club' or 'isActive' directly via this route if needed
    delete updates.club;
    delete updates.isActive; 

    const updatedYear = await FestivalYear.findOneAndUpdate(
      { _id: id, club: req.user.clubId },
      updates,
      { new: true }
    );

    if (!updatedYear) return res.status(404).json({ message: "Year not found" });

    res.json({ success: true, message: "Settings updated", data: updatedYear });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * @route POST /api/v1/years/:id/close
 * @desc Close the financial year
 */
exports.closeYear = async (req, res) => {
  try {
    const { id } = req.params;
    
    const year = await FestivalYear.findOne({ _id: id, club: req.user.clubId });
    if (!year) return res.status(404).json({ message: "Year not found" });

    // Mark as inactive
    year.isActive = false;
    await year.save();

    res.json({ success: true, message: `Year '${year.name}' has been closed.` });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};