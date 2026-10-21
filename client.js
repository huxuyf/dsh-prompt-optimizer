window.__ModuleLoader__.load({
  id: 'dsh-prompt-optimizer',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'dsh-prompt-optimizer';

    const zh = {
      optimize: '优化提示词',
      optimizing: '正在优化提示词…',
      done: '已优化提示词',
      empty: '输入框为空，没有可优化的内容',
      locked: '当前无法编辑输入框',
      unavailable: '优化服务不可用（未找到 /prompt-optimize 指令）',
    };

    const en = {
      optimize: 'Optimize prompt',
      optimizing: 'Optimizing prompt…',
      done: 'Prompt optimized',
      empty: 'The composer is empty; nothing to optimize',
      locked: 'The composer is not editable right now',
      unavailable: 'Optimizer unavailable (/prompt-optimize command not found)',
    };

    /** Component-local styles; unmounting the component removes the element. */
    const CSS = [
      '.dsw-prompt-optimizer-wrap{flex:none;display:inline-flex;align-items:center;gap:6px;min-width:0}',
      '.dsw-prompt-optimizer-trigger{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:none;border-radius:var(--dsw-radius-sm,8px);background:transparent;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-family:inherit;cursor:pointer}',
      '.dsw-prompt-optimizer-trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary))}',
      '.dsw-prompt-optimizer-trigger:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}',
      '.dsw-prompt-optimizer-trigger:disabled{cursor:default;opacity:.45}',
      '.dsw-prompt-optimizer-spin{animation:dsw-prompt-optimizer-rotate 1s linear infinite}',
      '@keyframes dsw-prompt-optimizer-rotate{to{transform:rotate(360deg)}}',
      '.dsw-prompt-optimizer-status{flex:none;max-width:180px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary))}',
    ].join('\n');

    /** Original sparkles artwork; inherits the trigger color through currentColor. */
    function SparkleIcon({ size, spinning }) {
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true,
        className: spinning ? 'dsw-prompt-optimizer-spin' : undefined,
        style: { display: 'block' },
      }, [
        h('path', { fill: 'currentColor', d: 'M11 2.4c.8 4.2 2.4 5.9 6.6 6.7-4.2.8-5.8 2.5-6.6 6.7-.8-4.2-2.4-5.9-6.6-6.7 4.2-.8 5.8-2.5 6.6-6.7Z' }),
        h('path', { fill: 'currentColor', opacity: .85, d: 'M18.2 13.2c.5 2.5 1.5 3.4 4 3.9-2.5.5-3.5 1.4-4 3.9-.5-2.5-1.5-3.4-4-3.9 2.5-.5 3.5-1.4 4-3.9Z' }),
        h('path', { fill: 'currentColor', opacity: .7, d: 'M5.4 15.2c.4 2 1.2 2.8 3.2 3.2-2 .4-2.8 1.2-3.2 3.2-.4-2-1.2-2.8-3.2-3.2 2-.4 2.8-1.2 3.2-3.2Z' }),
      ]);
    }

    /**
     * Compact optimize icon rendered before the model selector.
     * Reads the draft through the smallest input slice and replaces the whole
     * draft with the optimization result via inputActions.setDraft().
     */
    function OptimizeButton(props) {
      const { sessionId, inputActions, useInput, optimize, t } = props;
      const draft = useInput((value) => (value !== null && value !== undefined && typeof value.draft === 'string' ? value.draft : ''));
      const phase = useInput((value) => (value !== null && value !== undefined && typeof value.phase === 'string' ? value.phase : 'inert'));
      const [busy, setBusy] = React.useState(false);
      const [status, setStatus] = React.useState('');
      const abortRef = React.useRef(null);

      React.useEffect(() => {
        return () => {
          if (abortRef.current !== null) {
            abortRef.current.abort();
            abortRef.current = null;
          }
        };
      }, [sessionId]);

      React.useEffect(() => {
        if (status === '') return undefined;
        const timer = setTimeout(() => setStatus(''), 4000);
        return () => clearTimeout(timer);
      }, [status]);

      const editable = phase === 'plain';
      const hasText = draft.trim() !== '';

      const run = async () => {
        if (busy || !editable || !hasText || !sessionId) return;
        const controller = new AbortController();
        abortRef.current = controller;
        setBusy(true);
        setStatus('');
        try {
          const optimized = await optimize(sessionId, draft, controller.signal);
          if (controller.signal.aborted) return;
          if (typeof optimized !== 'string' || optimized.trim() === '') {
            setStatus(t('unavailable'));
            return;
          }
          inputActions.setDraft(optimized);
          setStatus(t('done'));
        } catch (failure) {
          if (controller.signal.aborted) return;
          setStatus(failure instanceof Error ? failure.message : String(failure));
        } finally {
          if (abortRef.current === controller) abortRef.current = null;
          setBusy(false);
        }
      };

      return h('span', { className: 'dsw-prompt-optimizer-wrap' },
        h('style', null, CSS),
        h('button', {
          type: 'button',
          className: 'dsw-prompt-optimizer-trigger',
          'aria-label': t('optimize'),
          title: busy ? t('optimizing') : (!editable ? t('locked') : (!hasText ? t('empty') : t('optimize'))),
          disabled: !editable || !hasText || busy,
          onMouseDown: (event) => { event.preventDefault(); },
          onClick: () => { run(); },
        }, h(SparkleIcon, { size: 16, spinning: busy })),
        status !== '' ? h('span', { className: 'dsw-prompt-optimizer-status', role: 'status', title: status }, status) : null,
      );
    }

    return {
      // `remote` here puts the Remote service into this module fiber's store
      // snapshot, so the ctx.inject child below resolves `child.remote` by
      // walking up to this fiber (the voice-input module declares it the same way).
      inject: ['slots', 'locale', 'remote'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }));
        // The `remote.commands` namespace service is provided by a sibling fiber
        // (api-remotes mounts it at boot), so the nested dotted path must be
        // declared as an inject dependency and reached through the callback's
        // child context — the same pattern the voice-input plugin uses for
        // `remote.speech`.
        ctx.inject(['remote.commands', 'slots', 'locale'], (child) => {
          const actions = {
            optimize: async (sessionId, text, signal) => {
              // commands/execute resolves through its direct variant (the gateway
              // cannot derive the agent identity from a root-level context), so the
              // call is positional: agentId (SessionId), line, submittedAttachments,
              // plus the optional caller AbortSignal.
              const outcome = await child.remote.commands.execute(
                sessionId,
                '/prompt-optimize\n' + text,
                [],
                signal,
              );
              if (!outcome || outcome.ok !== true) {
                throw (outcome !== null && outcome !== undefined && outcome.error) || new Error(zh.unavailable);
              }
              const execution = outcome.value;
              if (!execution || !execution.result) throw new Error(zh.unavailable);
              if (execution.result.kind === 'error') throw new Error(execution.result.text);
              return execution.result.text || '';
            },
          };
          child.slots.inject('conversation.input.right', () => child.slots.register({
            name: 'conversation.input.right',
            id: 'dsh-prompt-optimizer',
            order: 1,
            locale: NS,
            inject: () => actions,
          }, OptimizeButton));
        });
      },
    };
  },
});
