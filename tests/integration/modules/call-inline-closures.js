export default function createCallInlineClosures() {
  return [
    {
      name: 'format-total',
      handler: (_state, context) => {
        const total = Number(context.parameters?.total ?? 0);
        return { formatted: `$${total.toFixed(2)}` };
      },
    },
    {
      name: 'format-message',
      handler: (_state, context) => {
        const id = context.parameters?.id ?? 'unknown';
        const total = context.parameters?.total ?? 0;
        return `Order ${id} total ${total}`;
      },
    },
  ];
}
