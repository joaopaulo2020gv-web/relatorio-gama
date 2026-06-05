/**
 * Utilitário para acionar feedback háptico (vibração física) no dispositivo do usuário
 * @param {number} ms - Duração da vibração em milissegundos
 */
export const triggerHaptic = (ms = 12) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(ms);
    } catch (err) {
      console.warn('Feedback háptico não suportado ou negado:', err);
    }
  }
};
