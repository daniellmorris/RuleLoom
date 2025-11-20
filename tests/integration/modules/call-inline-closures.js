export default function createCallInlineClosures() {
  return [
    {
      name: 'format-total',
      handler: (_state, context) => {
        const total = Number(context.parameters?.total ?? 0);
        return { formatted: `$${total.toFixed(2)}` };
      },
      signature: {
        description: 'Formats a total into a USD string.',
        parameters: [{ name: 'total', type: 'number', required: true }],
        returns: { type: 'object' },
      },
    },
    {
      name: 'format-message',
      handler: (_state, context) => {
        const id = context.parameters?.id ?? 'unknown';
        const total = context.parameters?.total ?? 0;
        return `Order ${id} total ${total}`;
      },
      signature: {
        description: 'Produces a sentence summarizing the order id and total.',
        parameters: [
          { name: 'id', type: 'string', required: true },
          { name: 'total', type: 'any', required: true },
        ],
        returns: { type: 'string' },
      },
    },
  ];
}
