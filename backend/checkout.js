// Build a Mercado Pago Checkout Pro preference from a persisted server-priced order.
// Pure preparation only: does not contact Mercado Pago or initiate a charge.
export function buildPreference(order, returnBase, notificationUrl) {
  if (!order || typeof order.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(order.id) ||
      order.status !== 'created' || order.currency !== 'ARS' ||
      !Number.isSafeInteger(order.amountMinor) || order.amountMinor <= 0)
    throw new Error('invalid_order');
  const secureUrl = value => {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash)
      throw new Error('invalid_https_url');
    return url;
  };
  const base = secureUrl(returnBase);
  const notification = secureUrl(notificationUrl);
  const back = status => {
    const url = new URL(base);
    url.searchParams.set('checkout', status);
    return url.toString();
  };
  return {
    external_reference: order.id,
    items: [{ id: 'margenpro', title: 'MargenPro', quantity: 1,
      currency_id: 'ARS', unit_price: order.amountMinor / 100 }],
    back_urls: { success: back('success'), pending: back('pending'), failure: back('failure') },
    notification_url: notification.toString()
  };
}
