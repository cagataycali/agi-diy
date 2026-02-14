# Drag-and-Drop Docking System Specification

## Overview
Enable users to reorganize the dashboard layout by dragging widget headers to create dynamic split views (horizontal/vertical) and resize panels.

## Requirements

### 1. Draggable Headers
- **Current State**: Headers are draggable (foundation exists)
- **Behavior**: User can click and drag any widget header
- **Visual Feedback**: Cursor changes to indicate draggable state

### 2. Drop Zones
- **Trigger**: When dragging a widget over another widget
- **Zones**: Four drop zones per widget (top, right, bottom, left)
- **Visual Feedback**: 
  - Highlight drop zone with colored overlay
  - Show preview of resulting split layout
  - 50% opacity overlay on target half
- **Zone Detection**:
  - Top 25% of widget → horizontal split above
  - Bottom 25% → horizontal split below
  - Left 25% → vertical split left
  - Right 25% → vertical split right
  - Center 50% → replace/swap widgets

### 3. Split Creation
- **Horizontal Split**: Creates row container with two widgets stacked vertically
- **Vertical Split**: Creates column container with two widgets side-by-side
- **Initial Size**: Both widgets get 50% of space (flex: 1)
- **Nesting**: Splits can be nested infinitely (split within split)

### 4. Layout Tree Structure
```
layout: [
  { id: 'col-1', type: 'col', flex: 1, children: [
    { id: 'b-agents', type: 'agents', flex: 1 },
    { id: 'row-1', type: 'row', flex: 1, children: [
      { id: 'b-tasks', type: 'tasks', flex: 1 },
      { id: 'b-chat', type: 'chat', flex: 1 }
    ]}
  ]},
  { id: 'b-ring', type: 'ring', flex: 2 }
]
```

### 5. Resize Handles
- **Location**: Between adjacent widgets in split views
- **Visual**: 4px wide/tall bar with hover highlight
- **Behavior**: 
  - Drag to resize adjacent widgets
  - Update flex values proportionally
  - Minimum widget size: 200px
  - Cursor changes to resize indicator (↔ or ↕)

### 6. Edge Cases
- **Single Widget**: No drop zones (can't split into itself)
- **Maximized Widget**: Disable dragging/dropping
- **Empty Layout**: Always maintain at least one widget
- **Circular Drops**: Prevent dropping widget into its own children

### 7. Persistence
- **Save**: Layout structure saved to localStorage on change
- **Load**: Restore layout on page load
- **Reset**: Button to restore default layout

## User Flows

### Flow 1: Split Widget Horizontally
1. User drags "Tasks" widget header
2. Hovers over "Chat" widget
3. Moves to top 25% of Chat widget
4. Drop zone highlights top half of Chat
5. Releases mouse
6. Layout restructures: Chat splits into row with Tasks above, Chat below

### Flow 2: Resize Split
1. User hovers over divider between Tasks and Chat
2. Cursor changes to resize (↕)
3. User drags divider down
4. Tasks grows, Chat shrinks
5. Flex values update (e.g., Tasks: 1.5, Chat: 0.5)

### Flow 3: Swap Widgets
1. User drags "Ring" widget
2. Hovers over center of "Agents" widget
3. Center zone highlights entire widget
4. Releases mouse
5. Ring and Agents swap positions in layout tree

## Technical Constraints

### Performance
- Debounce drop zone calculations (16ms)
- Use CSS transforms for drag preview (not position)
- Minimize DOM reflows during drag

### Accessibility
- Keyboard navigation for widget focus
- Screen reader announcements for layout changes
- Focus management after drop

### Browser Support
- Modern browsers with Drag and Drop API
- Fallback: Disable docking, keep basic layout

## Success Criteria
- User can split any widget in 4 directions
- User can resize splits smoothly
- Layout persists across sessions
- No performance degradation with 10+ widgets
- Visual feedback is clear and immediate
