require("dotenv").config();
const mongoose = require("mongoose");
const { MONGO_URI } = require("../config/env");

const migrate = async () => {
  try {
    if (!MONGO_URI) throw new Error("MONGO_URI is undefined");
    
    await mongoose.connect(MONGO_URI);
    console.log("🔌 Connected to DB for Migration...");

    const db = mongoose.connection.db;

    // Helper for Atomic Update with Rounding
    // Uses Aggregation Pipeline in Update to ensure 10.56 -> 1056 (not 1056.000001)
    const intUpdate = [
      { 
        $set: { 
          amount: { $round: [{ $multiply: ["$amount", 100] }, 0] } 
        } 
      }
    ];

    // 1. Simple Collections (Direct Amount Field)
    await db.collection("expenses").updateMany({}, intUpdate);
    console.log("✅ Expenses migrated");

    await db.collection("donations").updateMany({}, intUpdate);
    console.log("✅ Donations migrated");

    await db.collection("memberfees").updateMany({}, intUpdate);
    console.log("✅ MemberFees migrated");

    // 2. Festival Years (Multiple Fields)
    await db.collection("festivalyears").updateMany({}, [
      {
        $set: {
          amountPerInstallment: { $round: [{ $multiply: ["$amountPerInstallment", 100] }, 0] },
          openingBalance: { $round: [{ $multiply: ["$openingBalance", 100] }, 0] },
          closingBalance: { $round: [{ $multiply: ["$closingBalance", 100] }, 0] }
        }
      }
    ]);
    console.log("✅ FestivalYears migrated");

    // 3. Clubs (Nested Settings)
    await db.collection("clubs").updateMany({}, [
      {
        $set: {
          "settings.defaultAmountPerInstallment": { 
            $round: [{ $multiply: ["$settings.defaultAmountPerInstallment", 100] }, 0] 
          }
        }
      }
    ]);
    console.log("✅ Clubs migrated");

    // 4. Subscriptions (Complex Nested Arrays)
    // We must loop here because MongoDB < 4.4 doesn't support $map easily in updates for this structure,
    // and it's safer to validate in code.
    const subs = await db.collection("subscriptions").find({}).toArray();
    let subCount = 0;
    
    for (const sub of subs) {
      // Migrate Root Totals
      const totalPaid = Math.round((sub.totalPaid || 0) * 100);
      const totalDue = Math.round((sub.totalDue || 0) * 100);

      // Migrate Installments
      let newInstallments = [];
      if (sub.installments && sub.installments.length > 0) {
        newInstallments = sub.installments.map(i => ({
          ...i,
          amountExpected: Math.round((i.amountExpected || 0) * 100)
        }));
      }

      await db.collection("subscriptions").updateOne(
        { _id: sub._id },
        { 
          $set: { 
            totalPaid, 
            totalDue,
            installments: newInstallments 
          } 
        }
      );
      subCount++;
    }
    console.log(`✅ ${subCount} Subscriptions migrated`);

    console.log("🎉 MIGRATION COMPLETE - ALL CURRENCIES ARE NOW INTEGERS (PAISE)");
    process.exit();
  } catch (err) {
    console.error("Migration Failed:", err);
    process.exit(1);
  }
};

migrate();