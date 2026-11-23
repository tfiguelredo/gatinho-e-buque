// Tudo o que costuma ser personalizado fica aqui.

export const CONFIG = {
  // Parte 1 — cartão que sai do envelope depois que o gatinho entrega a rosa
  // (no vídeo de referência: "will you go out with me?" + "[ ] yes  [ ] no").
  // false = o gatinho entrega só a rosa (sem envelope e sem cartão).
  showCard: false,
  cardText: 'will you go out with me?',
  cardOptions: ['[ ] yes', '[ ] no'],

  // Parte 2 — texto sob o buquê (igual ao repositório original).
  message: 'for you ♥',

  // Buquê — composição das flores:
  //   'colorido'           5 rosas brancas + tulipas rosa-chá e pêssego +
  //                        margaridas lilás e amarela
  //   'rosas'              10 rosas brancas
  //   'rosas-margaridas'   7 rosas + 3 margaridas brancas de miolo dourado
  //   'rosas-tulipas'      7 rosas + 3 tulipas brancas
  //   'rosas-mosquitinho'  10 rosas + mosquitinho bem mais denso
  // (para comparar sem editar: abra a página com ?buque=rosas#buque, por exemplo)
  bouquet: 'colorido',
  spinSpeed: 0.6, // velocidade do giro
  tilt: 0.3, // o quanto olhamos de cima
  camDist: 4.0, // menor = perspectiva mais dramática
  numHearts: 18, // corações flutuando ao fundo

  // Segundos que a cena do gatinho fica parada no final antes da transição
  catHold: 2.6,
};
