const API = 'http://127.0.0.1:5001/api';

function trocarAba(nomeAba, evt) {
    document.querySelectorAll('.aba-conteudo').forEach(aba => aba.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    const abaSelecionada = document.getElementById(`aba-${nomeAba}`);
    if (abaSelecionada) abaSelecionada.classList.add('active');

    const titulos = {
        'vagas': 'Status das Vagas no Pátio',
        'cliente': 'Cadastro de Clientes',
        'veiculo': 'Cadastro de Veículos',
        'entrada': 'Registro de Entrada',
        'saida': 'Registro de Saída e Cobrança',
        'estacionados': 'Veículos Estacionados no Momento'
    };
    document.getElementById('tituloPagina').innerText = titulos[nomeAba] || 'Painel de Controle';

    if (evt && evt.currentTarget) evt.currentTarget.classList.add('active');

    if (nomeAba === 'vagas') { carregarDashboard(); carregarVagas(); }
    if (nomeAba === 'veiculo') carregarSelectClientes();
    if (nomeAba === 'entrada') carregarSelectVagasLivres();
    if (nomeAba === 'estacionados') carregarEstacionados();
}

document.addEventListener('DOMContentLoaded', () => {
    carregarDashboard();
    carregarVagas();
    carregarEstacionados();
    carregarSelectClientes();
    carregarSelectVagasLivres();

    document.getElementById('btnAtualizar').addEventListener('click', () => {
        carregarDashboard();
        carregarVagas();
        carregarEstacionados();
    });

    // Cadastrar Cliente
    document.getElementById('formCliente').addEventListener('submit', async (e) => {
        e.preventDefault();
        const dados = {
            nome: document.getElementById('nomeCliente').value,
            cpf: document.getElementById('cpfCliente').value,
            telefone: document.getElementById('telCliente').value
        };
        try {
            const res = await fetch(`${API}/clientes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            const result = await res.json();

            // Exibe a mensagem real enviada pelo Flask (ex: "CPF já cadastrado.")
            alert(result.mensagem);

            if (res.ok) {
                document.getElementById('formCliente').reset();
                carregarSelectClientes();
            }
        } catch (error) {
            alert('Erro de conexão com o servidor. Verifique se o Flask está rodando.');
        }
    });

    // Cadastrar Veículo
    document.getElementById('formVeiculo').addEventListener('submit', async (e) => {
        e.preventDefault();
        const clienteId = document.getElementById('selectClienteVeiculo').value;
        if (!clienteId) {
            alert('Por favor, selecione um cliente.');
            return;
        }

        const dados = {
            placa: document.getElementById('placaVeiculo').value,
            modelo: document.getElementById('modeloVeiculo').value,
            cor: document.getElementById('corVeiculo').value,
            tamanho: document.getElementById('tamanhoVeiculo').value,
            tipo: document.getElementById('tipoVeiculo').value,
            ano: parseInt(document.getElementById('anoVeiculo').value),
            cliente_id: parseInt(clienteId)
        };
        try {
            const res = await fetch(`${API}/veiculos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            const result = await res.json();
            alert(result.mensagem);

            if (res.ok) {
                document.getElementById('formVeiculo').reset();
            }
        } catch (error) {
            alert('Erro ao cadastrar veículo.');
        }
    });

    // Registrar Entrada
    document.getElementById('formEntrada').addEventListener('submit', async (e) => {
        e.preventDefault();
        const vagaId = document.getElementById('selectVagaEntrada').value;
        if (!vagaId) {
            alert('Por favor, selecione uma vaga livre.');
            return;
        }

        const dados = {
            placa: document.getElementById('placaEntrada').value,
            vaga_id: parseInt(vagaId)
        };
        try {
            const res = await fetch(`${API}/entrada`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            const result = await res.json();
            alert(result.mensagem);

            if (res.ok) {
                document.getElementById('formEntrada').reset();
                carregarDashboard();
                carregarVagas();
                carregarSelectVagasLivres();
                carregarEstacionados();
            }
        } catch (error) {
            alert('Erro ao registrar entrada.');
        }
    });

    // Registrar Saída
    document.getElementById('formSaida').addEventListener('submit', async (e) => {
        e.preventDefault();
        const dados = {
            placa: document.getElementById('placaSaida').value
        };
        try {
            const res = await fetch(`${API}/saida`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            const result = await res.json();
            alert(result.mensagem);

            if (res.ok) {
                document.getElementById('formSaida').reset();
                carregarDashboard();
                carregarVagas();
                carregarSelectVagasLivres();
                carregarEstacionados();
            }
        } catch (error) {
            alert('Erro ao registrar saída.');
        }
    });
});

// Carregar Apenas Vagas Livres no Select de Entrada
async function carregarSelectVagasLivres() {
    try {
        const res = await fetch(`${API}/vagas`);
        const vagas = await res.json();
        const select = document.getElementById('selectVagaEntrada');
        if (!select) return;

        const vagasLivres = vagas.filter(v => v.status === 'LIVRE');

        if (vagasLivres.length === 0) {
            select.innerHTML = '<option value="">Nenhuma vaga livre no momento</option>';
            return;
        }

        select.innerHTML = '<option value="">Selecione uma Vaga Livre</option>';
        vagasLivres.forEach(v => {
            select.innerHTML += `<option value="${v.id}">Vaga ${v.numero} (${v.tipo})</option>`;
        });
    } catch (error) {
        console.error('Erro ao carregar vagas livres:', error);
    }
}

// Renderizar Dashboard
async function carregarDashboard() {
    try {
        const res = await fetch(`${API}/dashboard`);
        const data = await res.json();
        document.getElementById('dashTotal').innerText = data.total;
        document.getElementById('dashLivres').innerText = data.livres;
        document.getElementById('dashOcupadas').innerText = data.ocupadas;
        document.getElementById('dashTaxa').innerText = `${data.taxa}%`;
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
    }
}

// Carregar Lista de Clientes no Select de Cadastrar Veículo
async function carregarSelectClientes() {
    try {
        const res = await fetch(`${API}/clientes`);
        const clientes = await res.json();
        const select = document.getElementById('selectClienteVeiculo');
        if (!select) return;
        select.innerHTML = '<option value="">Selecione o Cliente</option>';
        clientes.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.nome} (CPF: ${c.cpf})</option>`;
        });
    } catch (error) {
        console.error('Erro ao carregar clientes no select:', error);
    }
}

// Renderizar Vagas
async function carregarVagas() {
    try {
        const res = await fetch(`${API}/vagas`);
        const vagas = await res.json();
        const grid = document.getElementById('gridVagas');
        grid.innerHTML = '';
        vagas.forEach(vaga => {
            const statusClass = vaga.status.toLowerCase();
            grid.innerHTML += `
                <div class="vaga-box ${statusClass}">
                    <div style="font-size: 1.1rem;">Vaga ${vaga.numero}</div>
                    <span class="tipo">${vaga.tipo}</span>
                    <span class="status-text">${vaga.status}</span>
                </div>
            `;
        });
    } catch (error) {
        console.error('Erro ao carregar vagas:', error);
    }
}

// Buscar Veículos Estacionados
async function carregarEstacionados() {
    try {
        const res = await fetch(`${API}/estacionados`);
        const dados = await res.json();
        const tbody = document.getElementById('tabelaEstacionados');
        if (!tbody) return;
        tbody.innerHTML = '';
        dados.forEach(item => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${item.placa}</strong></td>
                    <td>${item.modelo_marca}</td>
                    <td>Vaga ${item.numero}</td>
                    <td>${item.data_hora_entrada}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Erro ao buscar relatório:', error);
    }
}