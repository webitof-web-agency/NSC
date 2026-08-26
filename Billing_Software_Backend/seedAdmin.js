require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const adminExists = await User.findOne({ user_type: 1 });
    if (adminExists) {
      console.log('Admin user already exists:', adminExists.email);
    } else {
      const newAdmin = new User({
        firstName: 'Super',
        lastName: 'Admin',
        email: 'admin@nsc.com',
        phone: '1234567890',
        password: 'password123',
        user_type: 1
      });
      await newAdmin.save();
      console.log('Admin user created successfully:');
      console.log('Email: admin@nsc.com');
      console.log('Password: password123');
    }
    
    mongoose.connection.close();
  })
  .catch((err) => {
    console.error('Database connection error:', err);
  });
