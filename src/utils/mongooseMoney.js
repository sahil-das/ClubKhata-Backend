// Helper to store money as integers (paise) but work with floats (rupees)
// set: 100.50 -> 10050 (DB)
// get: 10050 -> "100.50" (App)

function getPrice(num) {
  // Handles null/undefined safely
  if (num === undefined || num === null) return num;
  return (num / 100).toFixed(2);
}

function setPrice(num) {
  // Handles empty strings/nulls
  if (num === "" || num === null || num === undefined) return 0;
  return Math.round(num * 100);
}

// Export the SchemaType definition AND the helpers
module.exports = { 
  type: Number, 
  get: getPrice, 
  set: setPrice,
  // Helpers for manual use in controllers
  toClient: getPrice, 
  toDB: setPrice 
};