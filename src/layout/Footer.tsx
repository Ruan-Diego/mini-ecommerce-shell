export function Footer() {
  return (
    <footer className="wrap">
      <div className="ftr">
        <span>mini. · Projeto de estudo · arquitetura hexagonal + microfrontends</span>
        <nav aria-label="Rodapé" style={{ display: 'flex', gap: 20 }}>
          <a href="https://github.com/Ruan-Diego/mini-ecommerce-backend#readme">Sobre o projeto</a>
          <a href="https://github.com/Ruan-Diego?tab=repositories&q=mini-ecommerce">Código-fonte</a>
        </nav>
      </div>
    </footer>
  );
}
