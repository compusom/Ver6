// Script temporal para probar la conexión SQL con diagnóstico detallado
// Uso: node test-sql-debug.js

import fetch from 'node-fetch';
import fs from 'fs';

async function testSqlConnection() {
    console.log('🔍 Iniciando diagnóstico COMPLETO de conexión SQL...\n');
    
    // IMPORTANTE: Configura aquí tus credenciales reales de SQL Server
    const sqlConfig = {
        server: 'localhost',     // Cambia por tu servidor (ej: 'localhost', '127.0.0.1', 'DESKTOP-ABC123\\SQLEXPRESS')
        port: '1433',           // Cambia por tu puerto (normalmente 1433)
        database: 'test_db',    // Cambia por tu base de datos real
        user: 'sa',             // Cambia por tu usuario real
        password: 'password123' // Cambia por tu contraseña real
    };
    
    console.log('⚠️  ANTES DE CONTINUAR:');
    console.log('   • Verifica que SQL Server esté ejecutándose');
    console.log('   • Confirma que las credenciales en este archivo sean correctas');  
    console.log('   • Asegúrate de que la base de datos existe');
    console.log('');
    
    try {
        console.log('📡 Enviando petición de diagnóstico...');
        console.log('🔧 Configuración:', { 
            server: sqlConfig.server, 
            port: sqlConfig.port, 
            database: sqlConfig.database, 
            user: sqlConfig.user 
        });
        console.log('');
        
        const response = await fetch('http://localhost:3001/api/sql/debug-connect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sqlConfig)
        });
        
        const result = await response.json();
        
        console.log('📋 RESULTADO DEL DIAGNÓSTICO COMPLETO');
        console.log('======================================\n');
        
        if (result.success) {
            console.log('✅ CONEXIÓN EXITOSA!');
            console.log(`📊 Tablas en base de datos: ${result.tablesCreated}`);
            if (result.statistics) {
                console.log(`📈 Estadísticas:`, result.statistics);
            }
        } else {
            console.log('❌ ERROR EN CONEXIÓN:', result.error);
        }
        
        console.log('\n📊 RESUMEN DE LOGS:');
        console.log('-------------------');
        if (result.summary) {
            console.log(`• Total de logs: ${result.summary.totalLogs}`);
            console.log(`• Errores: ${result.summary.errors}`);
            console.log(`• Advertencias: ${result.summary.warnings}`);
            console.log(`• Consultas SQL: ${result.summary.sqlQueries}`);
            console.log(`• Duración: ${result.summary.duration}ms`);
        }
        
        if (result.logFile) {
            console.log(`\n📄 Logs guardados en: ${result.logFile}`);
            console.log(`📄 Logs detallados en: sql-debug.log`);
            
            // Try to show the most critical errors
            try {
                const logContent = fs.readFileSync('sql-debug.log', 'utf8');
                const errorLines = logContent.split('\n').filter(line => 
                    line.includes('❌') || line.includes('ERROR') || line.includes('CRITICAL')
                );
                
                if (errorLines.length > 0) {
                    console.log('\n🚨 ERRORES CRÍTICOS ENCONTRADOS:');
                    console.log('================================');
                    errorLines.slice(0, 10).forEach((line, index) => {
                        console.log(`${index + 1}. ${line.trim()}`);
                    });
                    
                    if (errorLines.length > 10) {
                        console.log(`... y ${errorLines.length - 10} errores más en el archivo de log`);
                    }
                }
            } catch (readError) {
                console.log('No se pudo leer el archivo de log para mostrar errores');
            }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('🔍 ANÁLISIS COMPLETO TERMINADO');
        console.log('📋 Revisa los archivos de log para detalles completos');
        console.log('='.repeat(50));
        
    } catch (error) {
        console.error('💥 Error ejecutando diagnóstico:', error.message);
        console.log('\n🔧 Verifica que:');
        console.log('• El servidor esté corriendo en http://localhost:3001');
        console.log('• Las credenciales SQL en este script sean correctas');
        console.log('• SQL Server esté ejecutándose y accesible');
    }
}

// Ejecutar diagnóstico
testSqlConnection();