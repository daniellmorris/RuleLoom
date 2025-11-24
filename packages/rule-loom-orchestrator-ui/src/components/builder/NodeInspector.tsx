import { Badge, Button, Select, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import type { Node } from 'reactflow';
import type { ClosureDefinition } from '../../types/flow';
import type { BuilderNodeData } from './FlowBuilder';

interface NodeInspectorProps {
  node?: Node<BuilderNodeData>;
  closures: ClosureDefinition[];
  onUpdate: (id: string, data: Partial<BuilderNodeData>) => void;
  onDelete: (id: string) => void;
}

export default function NodeInspector({ node, closures, onUpdate, onDelete }: NodeInspectorProps) {
  if (!node) {
    return (
      <Stack gap={6}>
        <Text size="sm" c="dimmed">
          No node selected. Click a node to edit its settings.
        </Text>
      </Stack>
    );
  }

  const closureOptions = closures.map((closure, index) => ({
    value: closure.name ?? closure.type ?? `closure-${index}`,
    label: closure.name ?? closure.type ?? `closure-${index}`,
  }));

  return (
    <Stack gap="xs" key={node.id}>
      <Badge color={node.data.typeLabel === 'branch' ? 'purple' : 'indigo'} w="fit-content">
        {node.data.typeLabel}
      </Badge>
      <TextInput
        label="Label"
        value={node.data.label}
        onChange={(event) => onUpdate(node.id, { label: event.currentTarget.value })}
      />
      <Select
        label="Closure"
        data={closureOptions}
        value={node.data.closure ?? null}
        onChange={(value) => onUpdate(node.id, { closure: value ?? undefined })}
        searchable
        clearable
        placeholder="Pick a closure to invoke"
      />
      <TextInput
        label="Assign target"
        placeholder="response"
        value={node.data.assign ?? ''}
        onChange={(event) => onUpdate(node.id, { assign: event.currentTarget.value })}
      />
      <Textarea
        label="Parameters"
        placeholder="JSON or YAML-style parameters"
        minRows={4}
        autosize
        value={node.data.parameters ?? ''}
        onChange={(event) => onUpdate(node.id, { parameters: event.currentTarget.value })}
      />
      <Textarea
        label="When condition"
        placeholder="condition or closure-based predicate"
        minRows={3}
        autosize
        value={node.data.when ?? ''}
        onChange={(event) => onUpdate(node.id, { when: event.currentTarget.value })}
      />
      <Button
        color="red"
        leftSection={<IconTrash size={16} />}
        variant="light"
        onClick={() => onDelete(node.id)}
      >
        Remove node
      </Button>
    </Stack>
  );
}
