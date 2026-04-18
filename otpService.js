/**
 * OTP Service for Blood Finder
 * Handles generation and delivery of verification codes
 */

const generateOTP = () => {
  // Generate a 4-digit numeric code
  return Math.floor(1000 + Math.random() * 9000).toString();
};

const sendSMS = async (phoneNumber, message) => {
  // In a real production app, you would use Twilio, Vonage, or AWS SNS here
  console.log(`\n-----------------------------------------`);
  console.log(`[OUTGOING SMS] to ${phoneNumber}`);
  console.log(`Message: ${message}`);
  console.log(`-----------------------------------------\n`);
  
  return { success: true, sid: 'mock-' + Date.now() };
};

const sendOTP = async (phoneNumber, otp) => {
  const message = `Your Blood Finder verification code is: ${otp}. This code will expire in 10 minutes.`;
  return await sendSMS(phoneNumber, message);
};

const sendWelcomeSMS = async (phoneNumber, name) => {
  const message = `Welcome to Blood Finder, ${name}! Your phone number has been verified. You can now start saving lives!`;
  return await sendSMS(phoneNumber, message);
};

const sendRequestNotification = async (phoneNumber, bloodType, hospital) => {
  const message = `🩸 Urgent! ${bloodType} blood needed at ${hospital}. Open Blood Finder app to respond.`;
  return await sendSMS(phoneNumber, message);
};

const sendDonorResponseNotification = async (phoneNumber, donorName) => {
  const message = `${donorName} has responded to your blood request! Check the app for details.`;
  return await sendSMS(phoneNumber, message);
};

module.exports = {
  generateOTP,
  sendOTP,
  sendWelcomeSMS,
  sendRequestNotification,
  sendDonorResponseNotification
};
