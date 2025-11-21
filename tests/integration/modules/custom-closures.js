export default function createCustomClosures() {
  return [
    {
      name: 'compute-discount',
      handler: (state, context) => {
        const amount = Number(context.parameters?.amount ?? 0);
        const rate = Number(context.parameters?.rate ?? 0.1);
        const discounted = amount - amount * rate;
        state.discountedTotal = discounted;
        return discounted;
      },
      signature: {
        description: 'Applies a percentage discount to an amount.',
        parameters: [
          { name: 'amount', type: 'number', required: true },
          { name: 'rate', type: 'number', description: 'Discount rate between 0-1.' },
        ],
        returns: { type: 'number' },
        mutates: ['state.discountedTotal'],
      },
    },
  ];
}
