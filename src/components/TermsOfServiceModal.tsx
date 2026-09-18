"use client";

import React, { useState } from 'react';
import { FileText, CheckCircle, AlertTriangle, X } from 'lucide-react';

interface TermsOfServiceModalProps {
  isOpen: boolean;
  onAccept: () => void;
  userRole: 'rider' | 'establishment' | 'admin';
  userName: string;
}

export default function TermsOfServiceModal({ isOpen, onAccept, userRole, userName }: TermsOfServiceModalProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [hasReadTerms, setHasReadTerms] = useState(false);

  if (!isOpen) return null;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAccept = () => {
    if (!hasReadTerms) {
      alert('Por favor, marque a caixa confirmando que leu e concorda com os termos.');
      return;
    }
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-white/20 rounded-xl">
              <FileText className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-2xl font-black">Termos de Uso e Contrato de Prestação de Serviços</h2>
              <p className="text-indigo-100 text-sm">MotoHub Delivery - Sistema de Gestão de Entregas</p>
            </div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 mt-4 border border-white/20">
            <p className="text-sm font-bold">
              ⚠️ <span className="text-yellow-300">LEITURA OBRIGATÓRIA:</span> Por favor, leia atentamente todos os termos antes de utilizar o sistema.
            </p>
          </div>
        </div>

        {/* Content */}
        <div 
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-700 leading-relaxed"
        >
          
          {/* Identificação do Usuário */}
          <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4">
            <p className="font-bold text-indigo-900">
              <CheckCircle className="inline h-5 w-5 mr-2 text-indigo-600" />
              Usuário: <span className="text-indigo-600">{userName}</span>
            </p>
            <p className="text-sm text-indigo-700 mt-1">
              Perfil: <span className="font-bold">{userRole === 'rider' ? 'Motoboy / Entregador Autônomo' : userRole === 'establishment' ? 'Estabelecimento Comercial' : 'Administrador'}</span>
            </p>
          </div>

          {/* Data de Aceitação */}
          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
            <p><strong>Data de Aceitação:</strong> {new Date().toLocaleDateString('pt-BR', { 
              day: '2-digit', 
              month: 'long', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
            <p className="mt-1"><strong>Versão dos Termos:</strong> 1.0 (Setembro/2026)</p>
          </div>

          {/* Seção 1: Natureza Jurídica da Relação */}
          <section>
            <h3 className="text-xl font-black text-slate-900 mb-3 flex items-center gap-2 border-b-2 border-indigo-200 pb-2">
              <span className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">1</span>
              NATUREZA JURÍDICA DA RELAÇÃO - AUSÊNCIA DE VÍNCULO EMPREGATÍCIO
            </h3>
            
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-lg mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-bold text-yellow-900 mb-2">DECLARAÇÃO EXPRESSA DE AUTONOMIA PROFISSIONAL</p>
                  <p className="text-sm text-yellow-800">
                    O ENTREGADOR/MOTOBOY declara expressamente que atua como <strong>PROFISSIONAL AUTÔNOMO</strong>, 
                    não possuindo qualquer vínculo empregatício, societário ou de subordinação com:
                  </p>
                </div>
              </div>
            </div>

            <div className="ml-6 space-y-3">
              <p className="flex items-start gap-2">
                <span className="font-bold text-indigo-600 mt-1">a)</span>
                <span>A plataforma <strong>MOTOHUB DELIVERY</strong>, que atua exclusivamente como intermediadora tecnológica;</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-bold text-indigo-600 mt-1">b)</span>
                <span>Os <strong>ESTABELECIMENTOS COMERCIAIS</strong> cadastrados na plataforma;</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-bold text-indigo-600 mt-1">c)</span>
                <span>Qualquer outra pessoa física ou jurídica relacionada ao sistema.</span>
              </p>
            </div>

            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mt-4">
              <p className="font-black text-red-900 mb-2">🚫 CLÁUSULA DE EXCLUSÃO DE VÍNCULO:</p>
              <p className="text-sm text-red-800">
                Fica expressamente afastada qualquer caracterização de vínculo empregatício nos termos da 
                Consolidação das Leis do Trabalho (CLT - Decreto-Lei nº 5.452/1943), da Lei nº 13.467/2017 
                (Reforma Trabalhista) e da Lei nº 13.640/2018 (Lei dos Aplicativos de Transporte).
              </p>
            </div>
          </section>

          {/* Seção 2: Características da Prestação de Serviço Autônomo */}
          <section>
            <h3 className="text-xl font-black text-slate-900 mb-3 flex items-center gap-2 border-b-2 border-indigo-200 pb-2">
              <span className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">2</span>
              CARACTERÍSTICAS DA PRESTAÇÃO DE SERVIÇO AUTÔNOMO
            </h3>
            
            <p className="mb-4">O ENTREGADOR reconhece e declara que:</p>
            
            <div className="space-y-3 ml-6">
              <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p><strong>Autonomia Total:</strong> Possui total liberdade para aceitar ou recusar corridas/entregas, definir seus próprios horários e dias de trabalho, sem qualquer obrigatoriedade de comparecer ou cumprir jornada pré-estabelecida;</p>
              </div>
              
              <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p><strong>Ausência de Subordinação:</strong> Não está sujeito a ordens diretas, controle de jornada, fiscalização de métodos de trabalho ou qualquer forma de subordinação jurídica;</p>
              </div>
              
              <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p><strong>Remuneração por Demanda:</strong> Seus ganhos são <strong>EXCLUSIVAMENTE</strong> baseados em entregas efetivamente realizadas e finalizadas, sem qualquer garantia de renda mínima, salário fixo, 13º salário, férias remuneradas, FGTS ou demais verbas trabalhistas;</p>
              </div>
              
              <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p><strong>Meios Próprios:</strong> Utiliza veículo próprio, equipamentos próprios (capacete, celular, bag térmica, etc.) e arca com todos os custos operacionais (combustível, manutenção, seguro, IPVA, licenciamento);</p>
              </div>
              
              <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p><strong>Múltiplos Tomadores:</strong> Pode prestar serviços simultaneamente para outros aplicativos, plataformas ou estabelecimentos, sem exclusividade;</p>
              </div>
              
              <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p><strong>Risco do Negócio:</strong> Assume integralmente os riscos da atividade econômica, incluindo períodos de baixa demanda, custos operacionais elevados e eventual ausência de ganhos;</p>
              </div>
              
              <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p><strong>Registro Profissional:</strong> É responsável por manter documentação regular (CNH, registro de motoboy, documentação do veículo) e estar em conformidade com a legislação de trânsito.</p>
              </div>
            </div>
          </section>

          {/* Seção 3: Modelo de Remuneração */}
          <section>
            <h3 className="text-xl font-black text-slate-900 mb-3 flex items-center gap-2 border-b-2 border-indigo-200 pb-2">
              <span className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">3</span>
              MODELO DE REMUNERAÇÃO E REPASSES
            </h3>
            
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg mb-4">
              <p className="font-bold text-blue-900 mb-2">💰 SISTEMA DE PAGAMENTO POR ENTREGA</p>
              <p className="text-sm text-blue-800">
                O ENTREGADOR receberá valores <strong>EXCLUSIVAMENTE</strong> pelas entregas/corridas 
                efetivamente realizadas e concluídas com sucesso. Não há garantia de volume mínimo de 
                entregas, renda fixa ou qualquer outra forma de remuneração garantida.
              </p>
            </div>

            <div className="ml-6 space-y-3">
              <p><strong>3.1. Base de Cálculo:</strong> O valor de cada corrida é definido livremente entre o estabelecimento e o entregador, podendo variar conforme distância, complexidade, horário e outras condições de mercado;</p>
              
              <p><strong>3.2. Taxa Administrativa:</strong> A plataforma MotoHub Delivery pode reter uma taxa administrativa de R$ 1,00 (um real) por entrega para manutenção do sistema, conforme acordado previamente;</p>
              
              <p><strong>3.3. Repasse:</strong> Os valores devidos ao entregador serão repassados pelo estabelecimento comercial conforme acordado entre as partes (diário, semanal ou quinzenal), sendo a plataforma mera facilitadora do controle financeiro;</p>
              
              <p><strong>3.4. Ausência de Garantias:</strong> O entregador reconhece que não há garantia de:</p>
              <ul className="ml-6 space-y-1 text-sm">
                <li>• Quantidade mínima de corridas por período;</li>
                <li>• Renda mínima mensal ou semanal;</li>
                <li>• Estabilidade ou continuidade da demanda;</li>
                <li>• Qualquer compensação por períodos de inatividade ou espera.</li>
              </ul>
            </div>
          </section>

          {/* Seção 4: Responsabilidades */}
          <section>
            <h3 className="text-xl font-black text-slate-900 mb-3 flex items-center gap-2 border-b-2 border-indigo-200 pb-2">
              <span className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">4</span>
              RESPONSABILIDADES E OBRIGAÇÕES
            </h3>
            
            <p className="font-bold mb-3">4.1. Responsabilidades do ENTREGADOR:</p>
            <div className="ml-6 space-y-2 text-sm">
              <p>• Manter documentação pessoal e do veículo regularizada (CNH, CRLV, seguro obrigatório);</p>
              <p>• Cumprir integralmente o Código de Trânsito Brasileiro e legislação vigente;</p>
              <p>• Zelar pela segurança das entregas sob sua responsabilidade;</p>
              <p>• Manter conduta profissional e ética no relacionamento com estabelecimentos e clientes;</p>
              <p>• Arcar com todos os custos operacionais (combustível, manutenção, vestuário, equipamentos);</p>
              <p>• Responder civil e criminalmente por danos causados a terceiros durante a prestação do serviço;</p>
              <p>• Providenciar e manter seguro do veículo e seguro de vida/acidentes pessoais.</p>
            </div>

            <p className="font-bold mt-4 mb-3">4.2. Limitações da Plataforma MotoHub Delivery:</p>
            <div className="ml-6 space-y-2 text-sm">
              <p>• Atua exclusivamente como intermediadora tecnológica, fornecendo ferramenta de gestão;</p>
              <p>• Não possui ingerência na relação entre entregador e estabelecimento;</p>
              <p>• Não se responsabiliza por acidentes, multas ou danos decorrentes da atividade;</p>
              <p>• Não garante volume de corridas ou demanda mínima aos usuários;</p>
              <p>• Pode suspender ou encerrar acesso ao sistema em caso de uso inadequado.</p>
            </div>
          </section>

          {/* Seção 5: Uso do Sistema */}
          <section>
            <h3 className="text-xl font-black text-slate-900 mb-3 flex items-center gap-2 border-b-2 border-indigo-200 pb-2">
              <span className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">5</span>
              USO DO SISTEMA E SEGURANÇA
            </h3>
            
            <div className="ml-6 space-y-3 text-sm">
              <p><strong>5.1. Credenciais:</strong> O usuário é responsável pela segurança e confidencialidade de suas credenciais de acesso (login e senha);</p>
              
              <p><strong>5.2. Dados Pessoais:</strong> Os dados fornecidos serão tratados em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018);</p>
              
              <p><strong>5.3. Proibições:</strong> É vedado o uso do sistema para fins ilícitos, compartilhamento de conta, manipulação de dados ou qualquer conduta que viole estes termos;</p>
              
              <p><strong>5.4. Monitoramento:</strong> A plataforma pode monitorar o uso do sistema para fins de segurança, melhoria do serviço e cumprimento destes termos.</p>
            </div>
          </section>

          {/* Seção 6: Disposições Gerais */}
          <section>
            <h3 className="text-xl font-black text-slate-900 mb-3 flex items-center gap-2 border-b-2 border-indigo-200 pb-2">
              <span className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">6</span>
              DISPOSIÇÕES GERAIS E FINAIS
            </h3>
            
            <div className="ml-6 space-y-3 text-sm">
              <p><strong>6.1. Alterações:</strong> Estes termos podem ser atualizados periodicamente, sendo o usuário notificado sobre mudanças significativas;</p>
              
              <p><strong>6.2. Rescisão:</strong> O acesso pode ser encerrado a qualquer momento por qualquer das partes, sem ônus ou multa;</p>
              
              <p><strong>6.3. Lei Aplicável:</strong> Este contrato é regido pelas leis da República Federativa do Brasil;</p>
              
              <p><strong>6.4. Foro:</strong> Fica eleito o foro da comarca de João Pessoa/PB para dirimir quaisquer controvérsias decorrentes destes termos;</p>
              
              <p><strong>6.5. Integralidade:</strong> Este documento constitui a totalidade do acordo entre as partes, substituindo quaisquer entendimentos anteriores.</p>
            </div>
          </section>

          {/* Declaração Final */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-xl">
            <p className="font-black text-lg mb-3">📋 DECLARAÇÃO DE CIÊNCIA E CONCORDÂNCIA</p>
            <p className="text-sm leading-relaxed">
              Ao marcar a caixa abaixo e clicar em "ACEITAR E CONTINUAR", declaro que:
            </p>
            <ul className="text-sm space-y-2 mt-3 ml-4">
              <li>✓ Li, compreendi e concordo integralmente com todos os termos acima;</li>
              <li>✓ Tenho plena ciência da <strong>AUSÊNCIA DE VÍNCULO EMPREGATÍCIO</strong>;</li>
              <li>✓ Reconheço que atuo como <strong>PROFISSIONAL AUTÔNOMO</strong>;</li>
              <li>✓ Estou ciente que meus ganhos são <strong>EXCLUSIVAMENTE POR CORRIDAS REALIZADAS</strong>;</li>
              <li>✓ Entendo que não há garantia de renda mínima ou direitos trabalhistas (CLT);</li>
              <li>✓ Aceito todas as responsabilidades e obrigações aqui descritas.</li>
            </ul>
          </div>

          {/* Indicador de rolagem */}
          {!hasScrolledToBottom && (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4 mt-6 animate-pulse">
              <p className="text-center text-amber-900 font-bold">
                ⬇️ Role até o final para habilitar o botão de aceite
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="border-t-2 border-slate-200 bg-slate-50 p-6 space-y-4">
          
          {/* Checkbox de confirmação */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={hasReadTerms}
              onChange={(e) => setHasReadTerms(e.target.checked)}
              disabled={!hasScrolledToBottom}
              className="mt-1 h-5 w-5 rounded border-2 border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className={`text-sm ${hasScrolledToBottom ? 'text-slate-900' : 'text-slate-400'} ${hasReadTerms ? 'font-bold' : ''}`}>
              <strong>Declaro que li, compreendi e concordo integralmente com os Termos de Uso e Contrato de Prestação de Serviços,</strong> 
              {' '}incluindo a expressa <strong className="text-red-600">ausência de vínculo empregatício</strong> e as 
              condições de remuneração exclusivamente por demanda.
            </span>
          </label>

          {/* Botões */}
          <div className="flex gap-3">
            <button
              onClick={handleAccept}
              disabled={!hasReadTerms || !hasScrolledToBottom}
              className={`flex-1 py-4 rounded-xl font-black text-lg transition-all ${
                hasReadTerms && hasScrolledToBottom
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02]'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              {hasReadTerms && hasScrolledToBottom ? (
                <>
                  <CheckCircle className="inline h-6 w-6 mr-2" />
                  ACEITAR E CONTINUAR
                </>
              ) : (
                'Leia todos os termos para continuar'
              )}
            </button>
          </div>

          <p className="text-xs text-center text-slate-500">
            Ao aceitar, você confirma que está de acordo com todos os termos acima descritos.<br />
            Data: {new Date().toLocaleString('pt-BR')} | Versão: 1.0
          </p>
        </div>

      </div>
    </div>
  );
}
