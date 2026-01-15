import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
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
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

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
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface SortableSectionProps {
  section: ProposalSection;
  onUpdate: (updates: Partial<ProposalSection>) => void;
  onDelete: () => void;
  canEdit: boolean;
}

function SortableSection({ section, onUpdate, onDelete, canEdit }: SortableSectionProps) {
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
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
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
