export function calculate({ expression }) {
  try {
    return eval(expression);
  } catch (error) {
    return 'Erreur de calcul';
  }
}
