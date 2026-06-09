const Privacy = () => (
  <div className="container py-8 max-w-3xl prose prose-sm">
    <h1 className="font-display text-3xl mb-4">Privacy Policy</h1>
    <p className="text-muted-foreground mb-4">Last updated: {new Date().toLocaleDateString("en-LK")}</p>
    <div className="space-y-4 text-sm leading-relaxed">
      <p>ARTIXO ("we", "us") respects your privacy. This policy explains how we collect, use and protect your personal information when you use our marketplace.</p>
      <h2 className="font-semibold text-lg mt-6">Information We Collect</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Account info: name, email, phone number</li>
        <li>Order info: shipping address, items purchased, payment method</li>
        <li>Seller info: shop name, description, product listings</li>
      </ul>
      <h2 className="font-semibold text-lg mt-6">How We Use It</h2>
      <p>To process orders, communicate about deliveries, improve the platform, and comply with Sri Lankan law.</p>
      <h2 className="font-semibold text-lg mt-6">Sharing</h2>
      <p>We share order details with the relevant seller and delivery partner only. We never sell your data.</p>
      <h2 className="font-semibold text-lg mt-6">Your Rights</h2>
      <p>You may request access, correction, or deletion of your data by contacting support@artixo.lk.</p>
      <h2 className="font-semibold text-lg mt-6">Contact</h2>
      <p>Questions? Email <a className="text-primary" href="mailto:support@artixo.lk">support@artixo.lk</a></p>
    </div>
  </div>
);
export default Privacy;
