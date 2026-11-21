'use client';

import {
  SiFlutter, SiTypescript, SiExpress, SiPostgresql,
  SiMongodb, SiReact, SiNodedotjs, SiUnity,
  SiAngular, SiNestjs, SiRedis, SiSocketdotio, SiDocker,
  SiPython, SiRaspberrypi, SiFirebase,
} from 'react-icons/si';

const TECH_ICONS = {
  'Flutter':    <SiFlutter     size={13} color="#02569B" />,
  'TypeScript': <SiTypescript  size={13} color="#3178C6" />,
  'Express':    <SiExpress     size={13} color="currentColor" />,
  'PostgreSQL': <SiPostgresql  size={13} color="#4169E1" />,
  'MongoDB':    <SiMongodb     size={13} color="#47A248" />,
  'React':      <SiReact       size={13} color="#61DAFB" />,
  'Node.js':    <SiNodedotjs   size={13} color="#339933" />,
  'Unity':      <SiUnity       size={13} color="currentColor" />,
  'C#':         <img src="/icons/csharp.svg" alt="" width={13} height={13} />,
  'Angular':      <SiAngular      size={13} color="#DD0031" />,
  'NestJS':       <SiNestjs       size={13} color="#E0234E" />,
  'Redis':        <SiRedis        size={13} color="#FF4438" />,
  'Socket.IO':    <SiSocketdotio  size={13} color="currentColor" />,
  'Docker':       <SiDocker       size={13} color="#2496ED" />,
  'Python':       <SiPython       size={13} color="#3776AB" />,
  'Raspberry Pi': <SiRaspberrypi  size={13} color="#A22846" />,
  'Firebase':     <SiFirebase     size={13} color="#FFCA28" />,
};

export function TechPill({ name, ...rest }) {
  return (
    <span className="pj-pill" {...rest}>
      {TECH_ICONS[name]}
      {name}
    </span>
  );
}
