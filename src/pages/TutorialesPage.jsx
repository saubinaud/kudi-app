import { useNavigate } from 'react-router-dom';
import { useTutorial } from '../hooks/useTutorial';
import { TUTORIALS } from '../tutorials';
import KudiCharacter from '../components/KudiCharacter';
import { cx } from '../styles/tokens';
import { Check, Play, RotateCcw } from 'lucide-react';

export default function TutorialesPage() {
  const navigate = useNavigate();
  const { start, isCompleted, resetTutorial } = useTutorial();

  const handleStart = (tutorial) => {
    if (tutorial.route) navigate(tutorial.route);
    setTimeout(() => start(tutorial.id, tutorial.steps, { force: true }), 600);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-stone-900 mb-1">Tutoriales</h1>
        <p className="text-sm text-stone-500">
          Aprende a usar Kudi paso a paso. Puedes repetir cualquier tutorial las veces que necesites.
        </p>
      </div>

      <div className="grid gap-4">
        {TUTORIALS.map((tutorial) => {
          const completed = isCompleted(tutorial.id);
          return (
            <div
              key={tutorial.id}
              className={`${cx.card} p-5 flex items-center gap-5 transition-shadow hover:shadow-md`}
            >
              <div className="flex-shrink-0">
                <KudiCharacter expression={tutorial.expression} size={64} animate={false} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-[15px] font-semibold text-stone-900">{tutorial.title}</h3>
                  {completed && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-[10px] font-semibold">
                      <Check size={10} strokeWidth={3} /> Completado
                    </span>
                  )}
                </div>
                <p className="text-sm text-stone-500 mb-2">{tutorial.description}</p>
                <span className="text-xs text-stone-400">{tutorial.steps.length} pasos</span>
              </div>

              <button
                onClick={() => handleStart(tutorial)}
                className={`${completed ? cx.btnSecondary : cx.btnPrimary} flex items-center gap-2 flex-shrink-0`}
              >
                {completed ? <RotateCcw size={14} /> : <Play size={14} />}
                {completed ? 'Repetir' : 'Iniciar'}
              </button>
            </div>
          );
        })}
      </div>

      {TUTORIALS.length === 1 && (
        <div className="mt-8 text-center">
          <KudiCharacter expression="pensando" size={48} animate />
          <p className="text-sm text-stone-400 mt-2">Pronto habrá más tutoriales por módulo.</p>
        </div>
      )}
    </div>
  );
}
