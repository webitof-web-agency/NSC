const crypto = require("node:crypto");
const razorpay = require("../config/razorpay");
const Payment = require("../models/RazorpayPayment");

exports.createOrder = async (req, res) => {
  try {
    const { amount, referenceType, referenceNumber } = req.body;

    if (!amount || !referenceType || !referenceNumber) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const order = await razorpay.orders.create({
      amount: Number(amount),
      currency: "INR",
      receipt: referenceNumber, // 👈 invoice number
    });

    const payment = await Payment.create({
      referenceType,
      referenceNumber,
      orderId: order.id,
      amount: Number(amount),
      status: "created",
    });

    // console.log("Razorpay order amount (paise):", amount);

    res.json({
      success: true,
      order,
      paymentDbId: payment._id,
    });
  } catch (error) {
    console.error("Razorpay create order error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment details" });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid Razorpay signature",
      });
    }

    // ✅ Update payment status ONLY
    await Payment.findOneAndUpdate(
      { orderId: razorpay_order_id },
      {
        paymentId: razorpay_payment_id,
        status: "paid",
      }
    );

    res.json({
      success: true,
      message: "Payment verified successfully",
    });
  } catch (error) {
    console.error("Verify payment error:", error);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
    });
  }
};
