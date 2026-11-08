type Props = { paused: boolean };
export default function MeshBackground({ paused }: Props) {
  return (
    <div className={'mesh-background' + (paused ? ' mesh-still' : '')} aria-hidden="true">
      <div className="mesh-background-layer" />
    </div>
  );
}
