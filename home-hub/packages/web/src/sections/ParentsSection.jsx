import Card from '../components/ui/Card';
import RelayButton from '../components/RelayButton';

export default function ParentsSection({ parSw }) {
  return (
    <Card title="Cuarto de mis papás">
      <p className="mb-3 text-sm text-white/55">Solo el relevador de la luz.</p>
      <RelayButton device={parSw} label="par-sw" />
    </Card>
  );
}
