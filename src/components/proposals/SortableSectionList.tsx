import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SectionEditor } from './SectionEditor';
import type { ProposalSection } from '@/hooks/useProposalSections';

interface SortableSectionListProps {
  sections: ProposalSection[];
  onReorder: (sections: ProposalSection[]) => void;
  onUpdate: (id: string, updates: Partial<ProposalSection>) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
}

export function SortableSectionList({
  sections,
  onReorder,
  onUpdate,
  onDelete,
  canEdit,
}: SortableSectionListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeSection = activeId ? sections.find((s) => s.id === activeId) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before activating drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      const newSections = arrayMove(sections, oldIndex, newIndex);
      onReorder(newSections);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sections.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-4">
          {sections.map((section) => (
            <SortableSection
              key={section.id}
              section={section}
              onUpdate={(updates) => onUpdate(section.id, updates)}
              onDelete={() => onDelete(section.id)}
              canEdit={canEdit}
              isDraggingThis={activeId === section.id}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeSection ? (
          <div className="opacity-90 shadow-2xl ring-2 ring-primary rounded-lg">
            <SectionEditor
              section={activeSection}
              onUpdate={() => {}}
              onDelete={() => {}}
              canEdit={false}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface SortableSectionProps {
  section: ProposalSection;
  onUpdate: (updates: Partial<ProposalSection>) => void;
  onDelete: () => void;
  canEdit: boolean;
  isDraggingThis: boolean;
}

function SortableSection({ section, onUpdate, onDelete, canEdit, isDraggingThis }: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDraggingThis ? 'opacity-40 ring-2 ring-dashed ring-primary rounded-lg' : ''}
    >
      <SectionEditor
        section={section}
        onUpdate={onUpdate}
        onDelete={onDelete}
        canEdit={canEdit}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
