const DateFormat = require('@models/DateFormat');
const TimeFormat = require('@models/TimeFormat');
const Timezone = require('@models/Timezone');
const Localization = require('@models/Localization');
const Currency = require('@models/Currency');

const getDropdownOptions = async (req, res) => {
  try {
    const userId = req.user;

    const [localization, dateFormats, timeFormats, timezones] = await Promise.all([
      Localization.findOne({ user: userId, isActive: true })
        .populate('dateFormat', 'title format')
        .populate('timeFormat', 'name format')
        .populate('timezone', 'name utc_offset'),

      DateFormat.find({ isActive: true, isDeleted: false })
        .select('title format')
        .sort({ title: 1 }),

      TimeFormat.find({ isActive: true, isDeleted: false })
        .select('name format')
        .sort({ name: 1 }),

      Timezone.find()
        .select('name utc_offset')
        .sort({ name: 1 })
    ]);

    res.status(200).json({
      success: true,
      message: 'Localization and dropdown options retrieved successfully',
      data: {
        settings: localization
          ? {
              dateFormat: {
                id: localization.dateFormat._id,
                title: localization.dateFormat.title,
                format: localization.dateFormat.format
              },
              timeFormat: {
                id: localization.timeFormat._id,
                name: localization.timeFormat.name,
                format: localization.timeFormat.format
              },
              timezone: {
                id: localization.timezone._id,
                name: localization.timezone.name,
                offset: localization.timezone.utc_offset
              },
              startWeek: localization.startWeek
            }
          : null,

        dateFormats: dateFormats.map(format => ({
          id: format._id,
          title: format.title,
          format: format.format
        })),
        timeFormats: timeFormats.map(format => ({
          id: format._id,
          name: format.name,
          format: format.format
        })),
        timezones: timezones.map(zone => ({
          id: zone._id,
          name: zone.name,
          offset: zone.utc_offset
        }))
      }
    });

  } catch (err) {
    console.error('Error fetching localization & dropdowns:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching localization and dropdown options',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

const getSettingsDropdownList = async (req, res) => {
  try {
    const [timezones, dateFormats, currencies] = await Promise.all([
      Timezone.find({}).select('name utc_offset').sort({ name: 1 }),
      DateFormat.find({ isActive: true, isDeleted: false })
        .select('title format')
        .sort({ title: 1 }),
      Currency.find({ isDeleted: false, status: true })
        .select('name code symbol isDefault')
        .sort({ name: 1 })
    ]);

    return res.status(200).json({
      success: true,
      message: 'Timezone, Date Format, and Currency lists retrieved successfully',
      data: {
        timezones: timezones.map(zone => ({
          id: zone._id,
          name: zone.name,
          offset: zone.utc_offset
        })),
        dateFormats: dateFormats.map(fmt => ({
          id: fmt._id,
          title: fmt.title,
          format: fmt.format
        })),
        currencies: currencies.map(curr => ({
          id: curr._id,
          name: curr.name,
          code: curr.code,
          symbol: curr.symbol,
          isDefault: curr.isDefault
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching dropdown settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load dropdown settings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error'
    });
  }
};

const saveLocalization = async (req, res) => {
  try {
    const { dateFormatId, timeFormatId, timezoneId, startWeek } = req.body;

    let localization = await Localization.findOne({ isActive: true });

    if (localization) {
      localization.dateFormat = dateFormatId;
      localization.timeFormat = timeFormatId;
      localization.timezone = timezoneId;
      localization.startWeek = startWeek || localization.startWeek;

      await localization.save();

      return res.status(200).json({
        success: true,
        message: 'Localization settings updated successfully',
        data: localization
      });
    }

    localization = new Localization({
      dateFormat: dateFormatId,
      timeFormat: timeFormatId,
      timezone: timezoneId,
      startWeek: startWeek || 'Monday',
      isActive: true
    });

    await localization.save();

    return res.status(201).json({
      success: true,
      message: 'Localization settings saved successfully',
      data: localization
    });

  } catch (err) {
    console.error('Error saving localization:', err);
    return res.status(500).json({
      success: false,
      message: 'Error saving localization settings',
      error: err.message
    });
  }
};

const getLocalization = async (req, res) => {
  try {
    const localization = await Localization.findOne({ isActive: true })
      .populate('dateFormat', 'title format')
      .populate('timeFormat', 'name format')
      .populate('timezone', 'name utc_offset');

    if (!localization) {
      return res.status(404).json({
        success: false,
        message: 'No localization settings found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Localization settings retrieved successfully',
      data: {
        dateFormat: {
          id: localization.dateFormat._id,
          title: localization.dateFormat.title,
          format: localization.dateFormat.format
        },
        timeFormat: {
          id: localization.timeFormat._id,
          name: localization.timeFormat.name,
          format: localization.timeFormat.format
        },
        timezone: {
          id: localization.timezone._id,
          name: localization.timezone.name,
          offset: localization.timezone.utc_offset
        },
        startWeek: localization.startWeek
      }
    });

  } catch (err) {
    console.error('Error fetching localization:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching localization settings',
      error: err.message 
    });
  }
};


module.exports = {
  saveLocalization,
  getLocalization,
  getDropdownOptions,
  getSettingsDropdownList
};