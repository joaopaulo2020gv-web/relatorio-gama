# Script de deploy do frontend para a VPS AgroSkan
# Usa o módulo Posh-SSH ou ssh-copy-id manual

$VPS_IP = "2.25.172.44"
$VPS_USER = "root"
$VPS_PASS = "@Jp123Gd45678"

# Instala Posh-SSH se não existir
if (-not (Get-Module -ListAvailable -Name Posh-SSH)) {
    Write-Host "Instalando modulo Posh-SSH..." -ForegroundColor Yellow
    Install-Module -Name Posh-SSH -Force -Scope CurrentUser -SkipPublisherCheck
}

Import-Module Posh-SSH

$secPass = ConvertTo-SecureString $VPS_PASS -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($VPS_USER, $secPass)

Write-Host "Conectando a VPS $VPS_IP..." -ForegroundColor Cyan

# Cria sessão SSH
$session = New-SSHSession -ComputerName $VPS_IP -Credential $cred -AcceptKey -Force

if (-not $session) {
    Write-Host "ERRO: Falha ao conectar via SSH" -ForegroundColor Red
    exit 1
}

Write-Host "Conectado com sucesso!" -ForegroundColor Green

# 1. Descobrir onde está o projeto na VPS
$result = Invoke-SSHCommand -SessionId $session.SessionId -Command "find / -maxdepth 3 -name 'docker-compose.yml' -path '*agroskan*' -o -name 'docker-compose.yml' -path '*relatorio*' 2>/dev/null | head -5"
Write-Host "docker-compose encontrados: $($result.Output)" -ForegroundColor Yellow

$result2 = Invoke-SSHCommand -SessionId $session.SessionId -Command "docker ps --format '{{.Names}} {{.Status}}'"
Write-Host "Containers ativos:`n$($result2.Output)" -ForegroundColor Yellow

# Encontrar o diretório do projeto
$result3 = Invoke-SSHCommand -SessionId $session.SessionId -Command "find / -maxdepth 3 -name 'docker-compose.yml' 2>/dev/null"
Write-Host "Todos docker-compose:`n$($result3.Output)" -ForegroundColor Yellow

Remove-SSHSession -SessionId $session.SessionId | Out-Null
Write-Host "Sessao encerrada." -ForegroundColor Cyan
