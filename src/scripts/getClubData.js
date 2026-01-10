require("dotenv").config();
const mongoose = require("mongoose");

// Import Models
const User = require("../models/User");
const Club = require("../models/Club");
const Membership = require("../models/Membership");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/club_commitee_saas";

const extractData = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("🔌 Connected to DB...\n");

    // 1. Fetch All Clubs
    const clubs = await Club.find();

    if (clubs.length === 0) {
        console.log("⚠️ No clubs found in the database.");
    }

    for (const club of clubs) {
        console.log("====== 🏠 CLUB DETAILS ======");
        console.log(`Name:      ${club.name}`);
        console.log(`Club ID:   ${club._id}`); // Assuming 'owner' field stores the User ID
        console.log("-----------------------------");

        // 2. Fetch Members for this Club
        // We find Memberships linked to this club, then 'populate' the user details
        const memberships = await Membership.find({ club: '69611aeef52a40d5eb23371b' }).populate("user");
        
        console.log(`👥 Members (${memberships.length}):`);
        
        if (memberships.length === 0) {
            console.log("   No members found.");
        } else {
            // Sort nicely by name
            memberships.sort((a, b) => (a.user?.name || "").localeCompare(b.user?.name || ""));

            memberships.forEach(m => {
                if (m.user) {
                    console.log(`Name: ${m.user.name.padEnd(20)} | UserID: ${m.user.email}`);
                } else {
                    console.log(`   [Orphaned Membership] ID: ${m._id} (User not found)`);
                }
            });
        }
        console.log("\n=============================\n");
    }

    process.exit(0);

  } catch (error) {
    console.error("❌ Error fetching data:", error);
    process.exit(1);
  }
};

extractData();