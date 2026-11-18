import { criarEventBus } from './eventBus';

describe('eventBus', () => {
  it('entrega o payload ao ouvinte e para de entregar depois do unsubscribe', () => {
    const bus = criarEventBus(new EventTarget());
    const recebidos: number[] = [];
    const sair = bus.on('carrinho:atualizado', (p) => recebidos.push(p.quantidadeTotal));

    bus.emit('carrinho:atualizado', { quantidadeTotal: 2, subtotal: 508 });
    sair();
    bus.emit('carrinho:atualizado', { quantidadeTotal: 3, subtotal: 700 });

    expect(recebidos).toEqual([2]);
  });
});
