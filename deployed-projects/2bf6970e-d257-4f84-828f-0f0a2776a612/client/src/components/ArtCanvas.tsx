import React, { useMemo } from 'react';
import { z } from 'zod';

const ShapeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('rect'),
    x: z.number(),
    y: z.number(),
    w: z.number().positive(),
    h: z.number().positive(),
    fill: z.string().min(1)
  }),
  z.object({
    type: z.literal('circle'),
    cx: z.number(),
    cy: z.number(),
    r: z.number().positive(),
    fill: z.string().min(1)
  }),
  z.object({
    type: z.literal('line'),
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
    stroke: z.string().min(1),
    strokeWidth: z.number().positive().max(20)
  })
]);

const SceneSchema = z.object({
  width: z.number().positive().max(1200),
  height: z.number().positive().max(900),
  background: z.string().min(1),
  shapes: z.array(ShapeSchema).max(500)
});

export type Scene = z.infer<typeof SceneSchema>;

const defaultScene: Scene = {
  width: 800,
  height: 520,
  background: '#ffffff',
  shapes: []
};

export const makeSceneJson = (scene: Scene): string => JSON.stringify(scene);

export const parseSceneJson = (content: string): Scene => {
  const unknownValue: unknown = (() => {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  })();

  const parsed = SceneSchema.safeParse(unknownValue);
  return parsed.success ? parsed.data : defaultScene;
};

export interface ArtCanvasProps {
  content: string;
}

export const ArtCanvas = ({ content }: ArtCanvasProps): JSX.Element => {
  const scene = useMemo(() => parseSceneJson(content), [content]);

  return (
    <svg
      viewBox={`0 0 ${scene.width} ${scene.height}`}
      width="100%"
      style={{
        display: 'block',
        background: scene.background,
        border: '1px solid #e2e8f0',
        borderRadius: 12
      }}
      role="img"
      aria-label="Artwork preview"
    >
      {scene.shapes.map((s, idx) => {
        if (s.type === 'rect') {
          return <rect key={idx} x={s.x} y={s.y} width={s.w} height={s.h} fill={s.fill} />;
        }
        if (s.type === 'circle') {
          return <circle key={idx} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} />;
        }
        return (
          <line
            key={idx}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke={s.stroke}
            strokeWidth={s.strokeWidth}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
};
