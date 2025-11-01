export default function createCustomClosures() {
  return [
    {
      name: 'module.apply-discount',
      handler: (state, context) => {
        const amount = Number(context.parameters?.amount ?? 0);
        const rate = Number(context.parameters?.rate ?? 0.1);
        return amount - amount * rate;
      },
    },
  ];
}
