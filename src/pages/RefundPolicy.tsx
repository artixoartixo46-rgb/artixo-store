const RefundPolicy = () => (
  <div className="container py-8 max-w-3xl">
    <h1 className="font-display text-3xl mb-4">Refund & Return Policy</h1>
    <p className="text-muted-foreground mb-4">Last updated: {new Date().toLocaleDateString("en-LK")}</p>
    <div className="space-y-4 text-sm leading-relaxed">
      <h2 className="font-semibold text-lg">7-Day Return Window</h2>
      <p>You may request a return within 7 days of delivery if the product is damaged, defective, or significantly different from the listing.</p>
      <h2 className="font-semibold text-lg mt-6">How to Request a Refund</h2>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Email <a className="text-primary" href="mailto:support@artixo.lk">support@artixo.lk</a> with your order number and photos.</li>
        <li>We coordinate pickup with the seller (free for damaged items).</li>
        <li>Once the seller verifies, refund is issued within 5–7 business days.</li>
      </ol>
      <h2 className="font-semibold text-lg mt-6">Cash on Delivery Refunds</h2>
      <p>Refunds for COD orders are issued via bank transfer to your nominated account.</p>
      <h2 className="font-semibold text-lg mt-6">Non-Returnable Items</h2>
      <p>Perishable goods, intimate apparel, customized items, and gift cards cannot be returned.</p>
      <h2 className="font-semibold text-lg mt-6">Cancellations</h2>
      <p>You may cancel an order before it ships at no cost from the My Orders page or by contacting support.</p>
    </div>
  </div>
);
export default RefundPolicy;
