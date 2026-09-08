import { Briefing } from './components/Briefing';
import { Console } from './components/Console';
import { Debrief } from './components/Debrief';
import { HowItWorks } from './components/HowItWorks';
import { Missions } from './components/Missions';
import { TitleScreen } from './components/TitleScreen';
import { useSimulation } from './hooks/useSimulation';
import { useGame } from './store/gameStore';

export default function App() {
  useSimulation();
  const screen = useGame((s) => s.screen);

  if (screen === 'title') return <TitleScreen />;
  if (screen === 'how') return <HowItWorks />;
  if (screen === 'missions') return <Missions />;
  if (screen === 'briefing') return <Briefing />;
  if (screen === 'debrief') return <Debrief />;
  return <Console />;
}
