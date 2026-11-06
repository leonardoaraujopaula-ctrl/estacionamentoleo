from flask import Flask, render_template, request, jsonify
import sqlite3
from datetime import datetime

app = Flask(__name__)
DB_NAME = "estacionamento.db"

def conectar():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/dashboard', methods=['GET'])
def obter_dashboard():
    try:
        conn = conectar()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as total FROM vagas")
        total = cursor.fetchone()['total']
        
        cursor.execute("SELECT COUNT(*) as ocupadas FROM vagas WHERE status = 'OCUPADA'")
        ocupadas = cursor.fetchone()['ocupadas']
        
        livres = total - ocupadas
        taxa = round((ocupadas / total * 100), 1) if total > 0 else 0
        
        conn.close()
        return jsonify({
            "total": total,
            "ocupadas": ocupadas,
            "livres": livres,
            "taxa": taxa
        })
    except Exception as e:
        return jsonify({"status": "erro", "mensagem": f"Erro no servidor: {str(e)}"}), 500

@app.route('/api/clientes', methods=['GET'])
def listar_clientes():
    try:
        conn = conectar()
        cursor = conn.cursor()
        cursor.execute("SELECT id, nome, cpf, telefone, data_cadastramento FROM clientes ORDER BY id DESC")
        clientes = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify(clientes)
    except Exception as e:
        return jsonify({"status": "erro", "mensagem": f"Erro ao listar clientes: {str(e)}"}), 500

@app.route('/api/clientes', methods=['POST'])
def cadastrar_cliente():
    dados = request.json
    data_atual = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = conectar()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO clientes (nome, cpf, telefone, data_cadastramento) VALUES (?, ?, ?, ?)",
            (dados['nome'], dados['cpf'], dados['telefone'], data_atual)
        )
        conn.commit()
        return jsonify({"status": "sucesso", "mensagem": "Cliente cadastrado com sucesso!"})
    except sqlite3.IntegrityError:
        return jsonify({"status": "erro", "mensagem": "CPF já cadastrado no sistema."}), 400
    except Exception as e:
        return jsonify({"status": "erro", "mensagem": f"Erro interno: {str(e)}"}), 500
    finally:
        conn.close()

@app.route('/api/veiculos', methods=['POST'])
def cadastrar_veiculo():
    dados = request.json
    data_atual = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = conectar()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO veiculos (placa, cor, modelo_marca, tamanho, tipo, ano, cliente_id, data_cadastramento)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            dados['placa'], dados['cor'], dados['modelo'], dados['tamanho'], 
            dados['tipo'], dados['ano'], dados['cliente_id'], data_atual
        ))
        conn.commit()
        return jsonify({"status": "sucesso", "mensagem": "Veículo cadastrado com sucesso!"})
    except sqlite3.IntegrityError:
        return jsonify({"status": "erro", "mensagem": "Placa já cadastrada."}), 400
    except Exception as e:
        return jsonify({"status": "erro", "mensagem": f"Erro interno: {str(e)}"}), 500
    finally:
        conn.close()

@app.route('/api/vagas', methods=['GET'])
def listar_vagas():
    try:
        conn = conectar()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM vagas ORDER BY numero ASC")
        vagas = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify(vagas)
    except Exception as e:
        return jsonify({"status": "erro", "mensagem": f"Erro ao listar vagas: {str(e)}"}), 500

@app.route('/api/entrada', methods=['POST'])
def registrar_entrada():
    dados = request.json
    conn = conectar()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM veiculos WHERE placa = ?", (dados['placa'],))
        veiculo = cursor.fetchone()
        if not veiculo:
            conn.close()
            return jsonify({"status": "erro", "mensagem": "Veículo não cadastrado."}), 404

        cursor.execute("SELECT status FROM vagas WHERE id = ?", (dados['vaga_id'],))
        vaga = cursor.fetchone()
        if not vaga or vaga['status'] == 'OCUPADA':
            conn.close()
            return jsonify({"status": "erro", "mensagem": "Vaga indisponível ou inexistente."}), 400

        data_entrada = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute(
            "INSERT INTO registros (veiculo_id, vaga_id, data_hora_entrada) VALUES (?, ?, ?)",
            (veiculo['id'], dados['vaga_id'], data_entrada)
        )
        cursor.execute("UPDATE vagas SET status = 'OCUPADA' WHERE id = ?", (dados['vaga_id'],))
        
        conn.commit()
        return jsonify({"status": "sucesso", "mensagem": f"Entrada confirmada na vaga {dados['vaga_id']}!"})
    except Exception as e:
        return jsonify({"status": "erro", "mensagem": f"Erro interno: {str(e)}"}), 500
    finally:
        conn.close()

@app.route('/api/saida', methods=['POST'])
def registrar_saida():
    dados = request.json
    conn = conectar()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT r.id, r.vaga_id, r.data_hora_entrada 
            FROM registros r
            JOIN veiculos v ON r.veiculo_id = v.id
            WHERE v.placa = ? AND r.data_hora_saida IS NULL
        """, (dados['placa'],))
        registro = cursor.fetchone()

        if not registro:
            conn.close()
            return jsonify({"status": "erro", "mensagem": "Veículo não encontrado no pátio."}), 404

        data_saida = datetime.now()
        data_entrada = datetime.strptime(registro['data_hora_entrada'], "%Y-%m-%d %H:%M:%S")
        
        horas = max(1, int((data_saida - data_entrada).total_seconds() // 3600) + 1)
        valor_pago = horas * 10.0
        data_saida_str = data_saida.strftime("%Y-%m-%d %H:%M:%S")

        cursor.execute("""
            UPDATE registros 
            SET data_hora_saida = ?, valor_pago = ? 
            WHERE id = ?
        """, (data_saida_str, valor_pago, registro['id']))

        cursor.execute("UPDATE vagas SET status = 'LIVRE' WHERE id = ?", (registro['vaga_id'],))

        conn.commit()
        return jsonify({
            "status": "sucesso", 
            "mensagem": f"Saída registrada! Tempo: ~{horas}h | Total a pagar: R$ {valor_pago:.2f}"
        })
    except Exception as e:
        return jsonify({"status": "erro", "mensagem": f"Erro interno: {str(e)}"}), 500
    finally:
        conn.close()

@app.route('/api/estacionados', methods=['GET'])
def relatorio_estacionados():
    try:
        conn = conectar()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT v.placa, v.modelo_marca, vg.numero, r.data_hora_entrada 
            FROM registros r
            JOIN veiculos v ON r.veiculo_id = v.id
            JOIN vagas vg ON r.vaga_id = vg.id
            WHERE r.data_hora_saida IS NULL
        """)
        dados = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify(dados)
    except Exception as e:
        return jsonify({"status": "erro", "mensagem": f"Erro ao gerar relatório: {str(e)}"}), 500

if __name__ == '__main__':
    # Rodando na porta 5001 para evitar conflitos de porta no sistema
    app.run(debug=True, port=5001)