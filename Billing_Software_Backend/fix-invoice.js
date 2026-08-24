require('module-alias/register');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const Invoice = require('./models/Invoice');
const InvoicePayment = require('./models/InvoicePayment');

const fixInvoice = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("Connected to MongoDB");

    const invoiceId = "6a8ad0686ef8c3e3e9b6f9ea";
    
    const invoice = await Invoice.findByIdAndUpdate(
      invoiceId, 
      { $set: { payment_method: "UPI" } },
      { new: true }
    );
    
    if (invoice) {
      console.log(`Updated Invoice ${invoice.invoiceNumber} payment method to UPI.`);
    } else {
      console.log(`Invoice ${invoiceId} not found.`);
    }

    const payment = await InvoicePayment.findOneAndUpdate(
      { invoiceId: invoiceId },
      { $set: { payment_method: "UPI" } },
      { new: true, sort: { createdAt: -1 } }
    );

    if (payment) {
      console.log(`Updated associated Payment record to UPI.`);
    } else {
      console.log(`No payment record found for invoice.`);
    }

    console.log("Done fixing.");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

fixInvoice();
