require("dotenv").config();
const mongoose = require("mongoose");

// 1. CONFIGURATION
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/club_commitee_saas";

// 2. HARDCODED IDS (FROM YOUR DATA)
const CLUB_ID = "69611aeef52a40d5eb23371b";
const ADMIN_ID = "69611aeef52a40d5eb233719"; // Sahil

// Members Map
const MEMBERS = [
  { name: "Sahil", id: "69611aeef52a40d5eb233719" },
  { name: "Ayush", id: "69611b3af52a40d5eb233759" },
  { name: "Ashish", id: "69611b62f52a40d5eb233767" },
  { name: "Golu", id: "69611b77f52a40d5eb233775" },
  { name: "Gourav", id: "69611b95f52a40d5eb233783" },
  { name: "Mohit", id: "69611baef52a40d5eb233791" },
  { name: "Meghnath", id: "69611bcdf52a40d5eb23379f" },
  { name: "Nayan", id: "69611be1f52a40d5eb2337ad" },
  { name: "Piyush", id: "69611bf3f52a40d5eb2337bb" },
  { name: "Shubhojeet", id: "69611c15f52a40d5eb2337c9" }
];

// 3. MODELS
const FestivalYear = require("../models/FestivalYear");
const Expense = require("../models/Expense");
const MemberFee = require("../models/MemberFee");
const Donation = require("../models/Donation");
const Subscription = require("../models/Subscription");
const Membership = require("../models/Membership"); // 👈 ADDED THIS IMPORT

const seed = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("🔌 Connected to DB...");

    // --- DATA PREPARATION ---

    // Dates (DD/MM/YYYY -> JS Date)
    // 03/03/2022
    const startDate = new Date(2022, 2, 3); // Month is 0-indexed (2 = March)
    // 25/01/2023
    const endDate = new Date(2023, 0, 25); // 0 = Jan

    const openingBalance = 3270;

    // 1. CREATE FESTIVAL YEAR
    console.log("📅 Creating Year: Saraswati Puja 2023...");
    
    let yearDoc = await FestivalYear.findOne({ club: CLUB_ID, name: "Saraswati Puja 2023" });
    
    if (yearDoc) {
        console.log("   ⚠️ Year already exists. Updating values...");
    } else {
        yearDoc = new FestivalYear({
            club: CLUB_ID,
            name: "Saraswati Puja 2023",
            createdBy: ADMIN_ID
        });
    }

    yearDoc.startDate = startDate;
    yearDoc.endDate = endDate;
    yearDoc.openingBalance = openingBalance;
    yearDoc.subscriptionFrequency = "weekly";
    yearDoc.totalInstallments = 50;
    yearDoc.amountPerInstallment = 10;
    yearDoc.isActive = false; // Archive data is closed
    yearDoc.isClosed = true;

    await yearDoc.save();
    const yearId = yearDoc._id;

    // 2. EXPENSES
    console.log("💸 Seeding Expenses...");
    const expensesData = [
      { title: "Murti", amount: 2700, category: "Idol" },
      { title: "S.T.H", amount: 1500, category: "Decoration" },
      { title: "Visharjan", amount: 1500, category: "Transport" },
      { title: "Prashad", amount: 850, category: "Food" },
      { title: "Party", amount: 1140, category: "Food" },
      { title: "Others", amount: 1435, category: "Misc" }
    ];

    await Expense.deleteMany({ club: CLUB_ID, year: yearId });

    const expenseDocs = expensesData.map(e => ({
        club: CLUB_ID,
        year: yearId,
        title: e.title,
        amount: e.amount,
        category: e.category,
        date: endDate,
        status: "approved",
        recordedBy: ADMIN_ID
    }));
    await Expense.insertMany(expenseDocs);

    // 3. DONATIONS
    console.log("🎁 Seeding Donations...");
    await Donation.deleteMany({ club: CLUB_ID, year: yearId });

    await Donation.create({
        club: CLUB_ID,
        year: yearId,
        donorName: "Villagers",
        amount: 1366,
        collectedBy: ADMIN_ID,
        date: endDate
    });

    // 4. MEMBER FEES (200 per member)
    console.log("cx Seeding Member Fees...");
    await MemberFee.deleteMany({ club: CLUB_ID, year: yearId });

    const feeDocs = MEMBERS.map(m => ({
        club: CLUB_ID,
        year: yearId,
        user: m.id,
        amount: 200,
        notes: "Saraswati Puja Fee",
        collectedBy: ADMIN_ID,
        paidAt: endDate
    }));
    await MemberFee.insertMany(feeDocs);

    // 5. SUBSCRIPTIONS (50 Weeks, 10 Rs/week, Fully Paid)
    console.log("Kg Seeding Subscriptions...");
    
    // Generate the installments array ONCE
    const fullPaidInstallments = [];
    for(let i=1; i<=50; i++) {
        fullPaidInstallments.push({
            number: i,
            amountExpected: 10,
            isPaid: true,
            paidDate: endDate,
            collectedBy: ADMIN_ID
        });
    }
    const totalPaid = 50 * 10; // 500

    for (const member of MEMBERS) {
        // ✅ FIXED: Now using the imported Membership model
        const membership = await Membership.findOne({ user: member.id, club: CLUB_ID });
        
        if (!membership) {
            console.error(`   ❌ Membership not found for ${member.name}. Skipping sub.`);
            continue;
        }

        await Subscription.findOneAndUpdate(
            { club: CLUB_ID, year: yearId, member: membership._id },
            {
                installments: fullPaidInstallments,
                totalPaid: totalPaid,
                totalDue: 0
            },
            { upsert: true, new: true }
        );
    }

    // 6. CALCULATE & UPDATE CLOSING BALANCE
    const totalDonations = 1366;
    const totalFees = 200 * MEMBERS.length; // 2000
    const totalSubs = 500 * MEMBERS.length; // 5000
    const totalIncome = totalDonations + totalFees + totalSubs; // 8160
    
    const totalExpenses = 2700 + 1500 + 1500 + 850 + 1140 + 1435; // 9125

    const closingBalance = openingBalance + totalIncome - totalExpenses; // 2305

    console.log("🧮 Financial Summary:");
    console.log(`   Opening: ${openingBalance}`);
    console.log(`   Income:  ${totalIncome}`);
    console.log(`   Expense: ${totalExpenses}`);
    console.log(`   Closing: ${closingBalance}`);

    yearDoc.closingBalance = closingBalance;
    await yearDoc.save();

    console.log("✅ SEEDING COMPLETE!");
    process.exit(0);

  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

seed();