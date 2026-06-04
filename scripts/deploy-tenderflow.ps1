# Deploy tenderflow chaincode via CCAAS (avoids Windows Docker-in-Docker build failure)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Channel = if ($env:CHANNEL_ID) { $env:CHANNEL_ID } else { "fx-bridge-channel" }
$CcName = "tenderflow"
$CcVersion = "1.0"
$CcSeq = "1"
$CcLabel = "tenderflow_1"
$Orderer = "orderer1.clearing-raft.org:7050"
$OrdererCa = "/etc/hyperledger/fabric/organizations/ordererOrganizations/clearing-raft.org/orderers/orderer1.clearing-raft.org/msp/tlscacerts/tlsca.clearing-raft.org-cert.pem"
$CcaasDir = "$Root\chaincode\tenderflow\ccaas"
$PkgPath = "$Root\chaincode\tenderflow_ccaas.tar.gz"

Write-Host "[ccaas] Build code.tar.gz with connection.json..." -ForegroundColor Cyan
docker run --rm -v "${Root}:/work" -w /work/chaincode/tenderflow/ccaas alpine sh -c "tar czf code.tar.gz connection.json && ls -la"

Write-Host "[ccaas] Package CCAAS chaincode..." -ForegroundColor Cyan
docker run --rm -v "${Root}:/work" -w /work hyperledger/fabric-tools:2.5.12 `
    peer lifecycle chaincode package /work/chaincode/tenderflow_ccaas.tar.gz `
    --path /work/chaincode/tenderflow/ccaas --lang golang --label $CcLabel

Write-Host "[ccaas] Copy package to fabric-cli..." -ForegroundColor Cyan
docker cp $PkgPath fabric-cli:/tmp/tenderflow_ccaas.tar.gz

$orgs = @(
    @{ Msp = "CentralBankMSP"; Peer = "peer0.centralbank.gov"; Port = 7051; Domain = "centralbank.gov" },
    @{ Msp = "LiquidityBankAMSP"; Peer = "peer0.liquidity-bankA.com"; Port = 9051; Domain = "liquidity-bankA.com" },
    @{ Msp = "LiquidityBankBMSP"; Peer = "peer0.liquidity-bankB.com"; Port = 11051; Domain = "liquidity-bankB.com" }
)

$pkgIds = @{}
foreach ($o in $orgs) {
    $admin = "/etc/hyperledger/fabric/organizations/peerOrganizations/$($o.Domain)/users/Admin@$($o.Domain)/msp"
    $tls = "/etc/hyperledger/fabric/organizations/peerOrganizations/$($o.Domain)/peers/$($o.Peer)/tls/ca.crt"
    Write-Host "[ccaas] Install on $($o.Msp)..." -ForegroundColor Yellow
    $out = docker exec fabric-cli env `
        CORE_PEER_LOCALMSPID=$($o.Msp) `
        CORE_PEER_ADDRESS="$($o.Peer):$($o.Port)" `
        CORE_PEER_MSPCONFIGPATH=$admin `
        CORE_PEER_TLS_ENABLED=true `
        CORE_PEER_TLS_ROOTCERT_FILE=$tls `
        peer lifecycle chaincode install /tmp/tenderflow_ccaas.tar.gz 2>&1 | Out-String
    Write-Host $out
    if ($out -match 'Package ID: (\S+), Label:') { $pkgIds[$o.Msp] = $Matches[1] }
    elseif ($out -match 'Package ID: (\S+)') { $pkgIds[$o.Msp] = $Matches[1] }
}

$firstPkg = ($pkgIds.Values | Select-Object -First 1)
if (-not $firstPkg) { throw "No package ID returned from install" }
Write-Host "[ccaas] Package ID: $firstPkg" -ForegroundColor Green

Write-Host "[ccaas] Approve for each org..." -ForegroundColor Cyan
foreach ($o in $orgs) {
    $pid = $pkgIds[$o.Msp]
    $admin = "/etc/hyperledger/fabric/organizations/peerOrganizations/$($o.Domain)/users/Admin@$($o.Domain)/msp"
    $tls = "/etc/hyperledger/fabric/organizations/peerOrganizations/$($o.Domain)/peers/$($o.Peer)/tls/ca.crt"
    docker exec fabric-cli env `
        CORE_PEER_LOCALMSPID=$($o.Msp) `
        CORE_PEER_ADDRESS="$($o.Peer):$($o.Port)" `
        CORE_PEER_MSPCONFIGPATH=$admin `
        CORE_PEER_TLS_ENABLED=true `
        CORE_PEER_TLS_ROOTCERT_FILE=$tls `
        peer lifecycle chaincode approveformyorg `
        -o $Orderer --channelID $Channel --name $CcName --version $CcVersion `
        --package-id $pid --sequence $CcSeq --tls --cafile $OrdererCa 2>&1
}

Write-Host "[ccaas] Commit definition..." -ForegroundColor Cyan
$commitArgs = @(
    "lifecycle", "chaincode", "commit",
    "-o", $Orderer, "--channelID", $Channel, "--name", $CcName,
    "--version", $CcVersion, "--sequence", $CcSeq, "--tls", "--cafile", $OrdererCa
)
foreach ($o in $orgs) {
    $tls = "/etc/hyperledger/fabric/organizations/peerOrganizations/$($o.Domain)/peers/$($o.Peer)/tls/ca.crt"
    $commitArgs += @("--peerAddresses", "$($o.Peer):$($o.Port)", "--tlsRootCertFiles", $tls)
}
docker exec fabric-cli env `
    CORE_PEER_LOCALMSPID=CentralBankMSP `
    CORE_PEER_ADDRESS=peer0.centralbank.gov:7051 `
    CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/organizations/peerOrganizations/centralbank.gov/users/Admin@centralbank.gov/msp `
    CORE_PEER_TLS_ENABLED=true `
    CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/organizations/peerOrganizations/centralbank.gov/peers/peer0.centralbank.gov/tls/ca.crt `
    peer @commitArgs 2>&1

Write-Host "[ccaas] Start chaincode server container..." -ForegroundColor Cyan
Push-Location (Join-Path $Root "docker")
docker compose -f docker-compose-fabric-14.yaml up -d --build tenderflow_ccaas 2>&1
Pop-Location
Start-Sleep -Seconds 5
docker logs tenderflow_ccaas 2>&1 | Select-Object -Last 5

Write-Host "[ccaas] Set CORE_CHAINCODE_ID_NAME to package ID and restart..." -ForegroundColor Cyan
docker stop tenderflow_ccaas 2>$null
docker rm tenderflow_ccaas 2>$null
docker run -d --name tenderflow_ccaas --network fx-bridge_fx_bridge `
    -e CHAINCODE_SERVER_ADDRESS=0.0.0.0:9999 `
    -e CORE_CHAINCODE_ID_NAME=$firstPkg `
    -p 9999:9999 `
    fx-bridge-tenderflow_ccaas 2>&1
Start-Sleep -Seconds 3
docker logs tenderflow_ccaas 2>&1 | Select-Object -Last 8

Write-Host "[ccaas] Verify committed..." -ForegroundColor Green
docker exec fabric-cli env `
    CORE_PEER_LOCALMSPID=CentralBankMSP `
    CORE_PEER_ADDRESS=peer0.centralbank.gov:7051 `
    CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/organizations/peerOrganizations/centralbank.gov/users/Admin@centralbank.gov/msp `
    CORE_PEER_TLS_ENABLED=true `
    CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/organizations/peerOrganizations/centralbank.gov/peers/peer0.centralbank.gov/tls/ca.crt `
    peer lifecycle chaincode querycommitted -C $Channel --name $CcName 2>&1

Write-Host "[ccaas] Test invoke CreateTender..." -ForegroundColor Green
$payload = '{"tender_id":"MAS-2024-BRIDGE-001","project_name":"Ma''anshan Yangtze River Bridge","rfp_cid":"ipfs://QmTest","bid_bond_pct":2.0,"deadline":"2024-12-31T23:59:59Z"}'
$args = "{`"function`":`"CreateTender`",`"Args`":[`"$payload`"]}"
docker exec fabric-cli env `
    CORE_PEER_LOCALMSPID=CentralBankMSP `
    CORE_PEER_ADDRESS=peer0.centralbank.gov:7051 `
    CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/organizations/peerOrganizations/centralbank.gov/users/Admin@centralbank.gov/msp `
    CORE_PEER_TLS_ENABLED=true `
    CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/organizations/peerOrganizations/centralbank.gov/peers/peer0.centralbank.gov/tls/ca.crt `
    peer chaincode invoke -o $Orderer -C $Channel -n $CcName `
    -c $args --tls --cafile $OrdererCa `
    --peerAddresses peer0.centralbank.gov:7051 --tlsRootCertFiles /etc/hyperledger/fabric/organizations/peerOrganizations/centralbank.gov/peers/peer0.centralbank.gov/tls/ca.crt `
    --peerAddresses peer0.liquidity-bankA.com:9051 --tlsRootCertFiles /etc/hyperledger/fabric/organizations/peerOrganizations/liquidity-bankA.com/peers/peer0.liquidity-bankA.com/tls/ca.crt `
    --peerAddresses peer0.liquidity-bankB.com:11051 --tlsRootCertFiles /etc/hyperledger/fabric/organizations/peerOrganizations/liquidity-bankB.com/peers/peer0.liquidity-bankB.com/tls/ca.crt 2>&1

docker exec peer0.centralbank.gov peer channel getinfo -c $Channel 2>&1
