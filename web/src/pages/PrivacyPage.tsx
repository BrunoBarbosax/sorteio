import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import '../styles/public.css';

/** Política de Privacidade e Proteção de Dados (LGPD) — página estática. */
export default function PrivacyPage() {
  useEffect(() => {
    document.title = 'Política de Privacidade | Gorjeta 77 Lukas';
  }, []);

  return (
    <div className="page">
      <SiteHeader />

      <main className="container stack privacy-stack">
        <header className="privacy-head">
          <p className="eyebrow">LGPD — LEI Nº 13.709/2018</p>
          <h1 className="title-gold">Política de Privacidade e Proteção de Dados</h1>
          <p className="text-muted">
            Esta política explica de forma clara como os dados dos participantes do Gorjeta 77 Lukas
            são coletados, utilizados, armazenados e protegidos.
          </p>
        </header>

        <section className="card">
          <h2 className="card-title">1. Dados que coletamos</h2>
          <p className="privacy-body">Para participar dos sorteios, coletamos apenas o necessário:</p>
          <ul className="privacy-list mt-2">
            <li>
              <strong>Nome completo</strong> — identifica o participante e é exibido apenas em caso de
              vitória, conforme as regras do sorteio.
            </li>
            <li>
              <strong>ID do participante</strong> — identificador criado por você no momento do
              cadastro (letras, números, ponto, hífen ou sublinhado).
            </li>
            <li>
              <strong>Data e hora do cadastro</strong> — registradas automaticamente para garantir a
              ordem e a transparência do processo.
            </li>
          </ul>
          <p className="privacy-body mt-2">
            Não coletamos dados de localização, imagens, informações de navegação para rastreamento
            comercial nem nenhum dado além do necessário para o sorteio.
          </p>
        </section>

        <section className="card">
          <h2 className="card-title">2. Finalidade e base legal</h2>
          <p className="privacy-body">
            Os dados coletados são utilizados <strong>exclusivamente</strong> para incluir você entre
            os participantes dos sorteios, verificar a elegibilidade do cadastro, realizar o
            sorteio de forma auditável e divulgar os resultados oficiais.
          </p>
          <p className="privacy-body">
            A base legal para o tratamento é o <strong>consentimento</strong> do titular (art. 7º, I,
            da LGPD), fornecido no momento em que você confirma o cadastro. Você pode revogar esse
            consentimento a qualquer momento solicitando a exclusão do seu cadastro.
          </p>
        </section>

        <section className="card">
          <h2 className="card-title">3. O que NÃO pedimos</h2>
          <div className="alert alert-info">
            O Gorjeta 77 Lukas <strong>nunca</strong> solicita senha, dados bancários, número de
            cartão de crédito, CPF, documentos pessoais ou qualquer pagamento para participar. Desconfie
            de qualquer mensagem que peça essas informações em nosso nome.
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">4. Divulgação dos resultados</h2>
          <p className="privacy-body">
            A <strong>lista completa de participantes não é pública</strong> e nunca é divulgada em
            aberto. Apenas os resultados dos sorteios autorizados são publicados, contendo:
          </p>
          <ul className="privacy-list mt-2">
            <li>o nome do ganhador; e</li>
            <li>
              o ID do ganhador, <strong>somente quando configurado</strong> pela organização para
              aquele sorteio.
            </li>
          </ul>
        </section>

        <section className="card">
          <h2 className="card-title">5. Retenção dos dados</h2>
          <p className="privacy-body">
            Os dados são mantidos enquanto houver finalidade para o tratamento, ou seja, enquanto os
            cadastros estiverem ativos e enquanto existir histórico de sorteios a comprovar a
            regularidade de cada resultado. Encerrada essa finalidade, os dados poderão ser anonimizados
            ou excluídos de forma segura.
          </p>
        </section>

        <section className="card">
          <h2 className="card-title">6. Direitos do titular</h2>
          <p className="privacy-body">Conforme a LGPD, você pode solicitar a qualquer momento:</p>
          <ul className="privacy-list mt-2">
            <li>
              <strong>Confirmação e acesso</strong> aos dados que temos sobre você;
            </li>
            <li>
              <strong>Correção</strong> de dados incompletos ou desatualizados;
            </li>
            <li>
              <strong>Exclusão</strong> do seu cadastro (revogação do consentimento);
            </li>
            <li>
              <strong>Informações</strong> sobre compartilhamento dos dados.
            </li>
          </ul>
          <p className="privacy-body mt-2">
            Para exercer esses direitos, entre em contato com a organização pelos canais indicados na
            seção de contato desta política.
          </p>
        </section>

        <section className="card">
          <h2 className="card-title">7. Segurança da informação</h2>
          <ul className="privacy-list">
            <li>
              As <strong>senhas dos administradores</strong> são armazenadas apenas como hashes
              irreversíveis, nunca em texto puro.
            </li>
            <li>
              A comunicação com o site acontece sobre <strong>conexão criptografada (HTTPS)</strong>.
            </li>
            <li>
              O acesso à área administrativa é protegido por <strong>sessão autenticada</strong> com
              verificação de token (CSRF).
            </li>
          </ul>
        </section>

        <section className="card">
          <h2 className="card-title">8. Cookies</h2>
          <p className="privacy-body">
            Utilizamos apenas cookies técnicos necessários ao funcionamento do site, como o cookie de
            <strong> sessão administrativa</strong>. Não usamos cookies de publicidade, perfilamento
            ou rastreamento de terceiros.
          </p>
        </section>

        <section className="card card-gold">
          <h2 className="card-title">9. Contato do controlador</h2>
          <p className="privacy-body">
            Dúvidas, solicitações sobre seus dados ou pedidos previstos na LGPD devem ser encaminhados
            à organização responsável pelo Gorjeta 77 Lukas:
          </p>
          <p className="privacy-placeholder mt-2">
            [INSIRA AQUI O CONTATO DA ORGANIZAÇÃO PARA PEDIDOS DE DADOS]
          </p>
        </section>

        <p className="text-muted text-center">
          Voltar para a <Link to="/">página inicial</Link>.
        </p>
      </main>

      <footer className="site-footer home-footer mt-3">
        <div className="container">
          <p>© {new Date().getFullYear()} Gorjeta 77 Lukas — Sorteios oficiais.</p>
          <p className="mt-1">
            <Link to="/privacidade">Política de Privacidade</Link>
            {' · '}
            <Link to="/admin">Área restrita</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
