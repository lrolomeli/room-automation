import AutomationSection from './AutomationSection';
import TimerSection from './TimerSection';
import RatesCard from './RatesCard';
import HistorySection from './HistorySection';

export default function MasSection({ room, refresh }) {
  return (
    <div className="flex flex-col gap-3.5">
      <AutomationSection room={room} refresh={refresh} />
      <TimerSection room={room} refresh={refresh} />
      <RatesCard />
      <HistorySection />
    </div>
  );
}
