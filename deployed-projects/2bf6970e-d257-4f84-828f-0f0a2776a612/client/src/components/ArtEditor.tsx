import React, { useMemo, useState } from 'react';
import type { Art, ArtStatus, CreateArtRequest, UpdateArtRequest } from '../../../types/art.js';
import { ArtCanvas, makeSceneJson, parseSceneJson, type Scene } from './ArtCanvas.js';

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

const randomInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

const randomColor = (): string => {
  const colors = ['#0ea5e9', '#22c55e', '#a855f7', '#ef4444', '#f97316', '#0f172a', '#eab308'];
  return colors[randomInt(0, colors.length - 1)] ?? '#0ea5e9';
};

export interface ArtEditorValue {
  title: string;
  description: string;
  status: ArtStatus;
  content: string;
}

export interface ArtEditorProps {
  selected: Art | null;
  saving: boolean;
  onCreate: (req: CreateArtRequest) => Promise<void>;
  onUpdate: (id: string, req: UpdateArtRequest) => Promise<void>;
  onResetSelection: () => void;
}

export const ArtEditor = ({ selected, saving, onCreate, onUpdate, onResetSelection }: ArtEditorProps): JSX.Element => {
  const initial: ArtEditorValue = useMemo(() => {
    if (!selected) {
      const scene: Scene = {
        width: 800,
        height: 520,
        background: '#ffffff',
        shapes: [
          { type: 'rect', x: 80, y: 70, w: 240, h: 160, fill: '#0ea5e9' },
          { type: 'circle', cx: 520, cy: 220, r: 90, fill: '#a855f7' },
          { type: 'line', x1: 60, y1: 440, x2: 740, y2: 420, stroke: '#0f172a', strokeWidth: 6 }
        ]
      };
      return {
        title: 'Untitled Artwork',
        description: 'A simple vector scene. Add shapes and publish when ready.',
        status: 'draft',
        content: makeSceneJson(scene)
      };
    }
    return {
      title: selected.title,
      description: selected.description,
      status: selected.status,
      content: selected.content
    };
  }, [selected]);

  const [value, setValue] = useState<ArtEditorValue>(initial);

  React.useEffect(() => {
    setValue(initial);
  }, [initial]);

  const scene = useMemo(() => parseSceneJson(value.content), [value.content]);

  const updateScene = (next: Scene): void => {
    setValue((v) => ({ ...v, content: makeSceneJson(next) }));
  };

  const addRect = (): void => {
    const w = randomInt(60, 220);
    const h = randomInt(50, 180);
    const next: Scene = {
      ...scene,
      shapes: [
        ...scene.shapes,
        {
          type: 'rect',
          x: randomInt(20, clamp(scene.width - w - 20, 20, scene.width)),
          y: randomInt(20, clamp(scene.height - h - 20, 20, scene.height)),
          w,
          h,
          fill: randomColor()
        }
      ]
    };
    updateScene(next);
  };

  const addCircle = (): void => {
    const r = randomInt(24, 110);
    const next: Scene = {
      ...scene,
      shapes: [
        ...scene.shapes,
        {
          type: 'circle',
          cx: randomInt(r + 10, scene.width - r - 10),
          cy: randomInt(r + 10, scene.height - r - 10),
          r,
          fill: randomColor()
        }
      ]
    };
    updateScene(next);
  };

  const addLine = (): void => {
    const next: Scene = {
      ...scene,
      shapes: [
        ...scene.shapes,
        {
          type: 'line',
          x1: randomInt(20, scene.width - 20),
          y1: randomInt(20, scene.height - 20),
          x2: randomInt(20, scene.width - 20),
          y2: randomInt(20, scene.height - 20),
          stroke: randomColor(),
          strokeWidth: randomInt(2, 10)
        }
      ]
    };
    updateScene(next);
  };

  const clearShapes = (): void => {
    updateScene({ ...scene, shapes: [] });
  };

  const save = async (): Promise<void> => {
    const req: CreateArtRequest = {
      title: value.title.trim(),
      description: value.description,
      status: value.status,
      content: value.content
    };

    if (!selected) {
      await onCreate(req);
      return;
    }

    const updateReq: UpdateArtRequest = {
      title: req.title,
      description: req.description,
      status: req.status,
      content: req.content
    };

    await onUpdate(selected.id, updateReq);
  };

  return (
    <div className="card">
      <div className="itemTop">
        <h2>{selected ? 'Edit artwork' : 'Create artwork'}</h2>
        {selected ? (
          <button className="secondary" type="button" onClick={onResetSelection} disabled={saving}>
            New
          </button>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          value={value.title}
          onChange={(e) => setValue((v) => ({ ...v, title: e.target.value }))}
          maxLength={120}
        />
      </div>

      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={value.description}
          onChange={(e) => setValue((v) => ({ ...v, description: e.target.value }))}
          maxLength={2000}
        />
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={value.status}
            onChange={(e) => setValue((v) => ({ ...v, status: e.target.value as ArtStatus }))}
          >
            <option value="draft">draft</option>
            <option value="published">published</option>
          </select>
        </div>
        <div className="field">
          <label>Scene</label>
          <div className="muted">{scene.width}×{scene.height} • {scene.shapes.length} shapes</div>
        </div>
      </div>

      <div className="canvasWrap">
        <ArtCanvas content={value.content} />
        <div className="canvasControls">
          <button type="button" className="secondary" onClick={addRect} disabled={saving}>
            Add rectangle
          </button>
          <button type="button" className="secondary" onClick={addCircle} disabled={saving}>
            Add circle
          </button>
          <button type="button" className="secondary" onClick={addLine} disabled={saving}>
            Add line
          </button>
          <button type="button" className="secondary" onClick={clearShapes} disabled={saving}>
            Clear
          </button>
        </div>
      </div>

      <hr />

      <div className="field">
        <label htmlFor="content">Content (JSON)</label>
        <textarea
          id="content"
          value={value.content}
          onChange={(e) => setValue((v) => ({ ...v, content: e.target.value }))}
        />
        <div className="muted">Stored as text in the database. Preview renders as SVG.</div>
      </div>

      <button type="button" onClick={() => void save()} disabled={saving || value.title.trim().length === 0}>
        {saving ? 'Saving…' : selected ? 'Save changes' : 'Create artwork'}
      </button>
    </div>
  );
};
