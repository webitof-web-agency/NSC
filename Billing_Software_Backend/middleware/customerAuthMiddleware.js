const jwt = require('jsonwebtoken');
const Customer = require('@models/Customer');

const customerProtect = async (req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  try {
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);

    if (decoded.type !== 'customer') {
      return res.status(401).json({ message: 'Invalid customer token' });
    }

    const customer = await Customer.findOne({
      _id: decoded.id,
      isDeleted: false,
      portalEnabled: { $ne: false },
    });

    if (!customer) {
      return res.status(401).json({ message: 'Customer not found or portal disabled' });
    }

    req.customer = customer;
    req.customerId = customer._id;
    req.ownerUserId = customer.userId;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = customerProtect;
