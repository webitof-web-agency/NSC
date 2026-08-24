const User = require('../models/User');
const Country = require('../models/Country');
const State = require('../models/State');
const City = require('../models/City');
const mongoose = require('mongoose');
exports.dashboard = async (req, res) => {
  const userData = await User.findById(req.user);
  res.json({
    message: 'Admin dashboard',
    user: userData,
  });
};

exports.getCountries = async (req, res) => {
  try {
    const { search } = req.query;
    const query = {};
    const projection = { _id: 1, name: 1 };

    if (search) {
      query.name = { $regex: search, $options: 'i' };
      const countries = await Country.find(query, projection).lean();
      res.json(countries);
    } else {
      const countries = await Country.find(query, projection).limit(10).lean();
      res.json(countries);
    }
  } catch (err) {
    res.status(500).json({ message: 'Error fetching countries', error: err.message });
  }
};

exports.getStates = async (req, res) => {
  const countryId = parseInt(req.params.countryId);
  try {
    const { search } = req.query;
    const query = { country_id: countryId };
    const projection = { _id: 1, name: 1 };

    if (search) {
      query.name = { $regex: search, $options: 'i' };
      const states = await State.find(query, projection).lean();
      res.json(states);
    } else {
      const states = await State.find(query, projection).limit(10).lean();
      res.json(states);
    }
  } catch (err) {
    res.status(500).json({ message: 'Error fetching states', error: err.message });
  }
};

exports.getCities = async (req, res) => {
  const stateId = parseInt(req.params.stateId);
  try {
    const { search } = req.query;
    const query = { state_id: stateId };
    const projection = { _id: 1, name: 1 };

    if (search) {
      query.name = { $regex: search, $options: 'i' };
      const cities = await City.find(query, projection).lean();
      res.json(cities);
    } else {
      const cities = await City.find(query, projection).limit(10).lean();
      res.json(cities);
    }
  } catch (err) {
    res.status(500).json({ message: 'Error fetching cities', error: err.message });
  }
};

//getProfile
exports.getProfile = async (req, res) => {
  try {
    // Find the user and populate the country, state, and city fields.
    // We select only the '_id' and 'name' fields from the populated documents for efficiency.
    const user = await User.findById(req.user)
      .populate({
        path: 'country',
        select: '_id name'
      })
      .populate({
        path: 'state',
        select: '_id name'
      })
      .populate({
        path: 'city',
        select: '_id name'
      })
      .select('-password'); // Exclude the password from the final result

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // The user object now contains nested objects for country, state, and city
    res.json(user.toJSON());

  } catch (err) {
    res.status(500).json({ message: 'Error fetching user profile', error: err.message });
  }
};
exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const allowedFields = [
      'firstName',
      'lastName',
      'email',
      'gender',
      'address',
      'city',
      'country',
      'dateOfBirth',
      'phone',
      'state',
      'postalCode',
    ];

    const updateData = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    if (req.file) {
      updateData.profileImage = `uploads/${req.file.filename}`;
    }

    Object.entries(updateData).forEach(([key, value]) => {
      user[key] = value;
    });

    if (req.body.newPassword) {
      if (Number(user.user_type) !== 1) {
        return res.status(403).json({ message: 'Only admin users can change password from profile settings' });
      }
      user.password = req.body.newPassword;
    }

    const updatedUser = await user.save();

    res.json({
      message: 'User profile updated successfully',
      user: updatedUser.toJSON(),
    });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(409).json({
        message: 'Email address is already in use.',
        error: err.message,
      });
    }
    res.status(500).json({
      message: 'Error updating user profile',
      error: err.message,
    });
  }

};

exports.getCountryById = async (req, res) => {
    const countryId = parseInt(req.params.id, 10);
    if (isNaN(countryId)) {
        return res.status(400).json({ message: 'Invalid country ID format. Must be an integer.' });
    }

    try {
        const country = await Country.findById(countryId).lean();
        if (!country) {
            return res.status(404).json({ message: 'Country not found' });
        }
        res.json(country);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching country', error: err.message });
    }
};

// -----

exports.getStateById = async (req, res) => {
    const stateId = parseInt(req.params.id, 10);

    if (isNaN(stateId)) {
        return res.status(400).json({ message: 'Invalid state ID format. Must be an integer.' });
    }

    try {
        const state = await State.findById(stateId).lean();
        if (!state) {
            return res.status(404).json({ message: 'State not found' });
        }
        res.json(state);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching state', error: err.message });
    }
};

// -----

exports.getCityById = async (req, res) => {
    const cityId = parseInt(req.params.id, 10);
    if (isNaN(cityId)) {
        return res.status(400).json({ message: 'Invalid city ID format. Must be an integer.' });
    }

    try {
        const city = await City.findById(cityId).lean();
        if (!city) {
            return res.status(404).json({ message: 'City not found' });
        }
        res.json(city);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching city', error: err.message });
    }
};
