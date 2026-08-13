import WhatsAppAnalyticsPage from './WhatsAppAnalyticsPage';

const WhatsAppDelivered = () => (
  <WhatsAppAnalyticsPage
    title="Delivered Messages"
    subtitle="Review every message that reached the customer's WhatsApp inbox."
    focusStatus="delivered"
    metricLabel="Delivered messages"
  />
);

export default WhatsAppDelivered;
