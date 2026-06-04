# Channel participation via fabric-cli container (Windows)
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ChannelId = if ($env:CHANNEL_ID) { $env:CHANNEL_ID } else { "fx-bridge-channel" }
$Block = "/etc/hyperledger/fabric/channel-artifacts/$ChannelId.block"
$OrgRoot = "/etc/hyperledger/fabric/organizations"

Write-Host "[tenderflow] Waiting for orderers/peers..." -ForegroundColor Cyan
Start-Sleep -Seconds 30

$orderers = @("orderer1","orderer2","orderer3","orderer4","orderer5")
foreach ($o in $orderers) {
    $fqdn = "$o.clearing-raft.org"
    docker cp (Join-Path $Root "channel-artifacts\$ChannelId.block") "${fqdn}:/var/hyperledger/orderer/channel-artifacts/$ChannelId.block" 2>$null
    Write-Host "[tenderflow] orderer join $fqdn" -ForegroundColor Yellow
    docker exec fabric-cli osnadmin channel join --channelID $ChannelId `
        --config-block $Block `
        --orderer-address "${fqdn}:7053" 2>&1 | Select-Object -Last 3
}

function Join-Peer {
    param($Org, $Msp, $PeerIdx, $Port)
    $fqdn = "peer$PeerIdx.$Org"
    $adminMsp = "$OrgRoot/peerOrganizations/$Org/users/Admin@${Org}/msp"
    $tlsCa = "$OrgRoot/peerOrganizations/$Org/peers/$fqdn/tls/ca.crt"
    Write-Host "[tenderflow] peer join $fqdn" -ForegroundColor Yellow
    docker exec fabric-cli env `
        CORE_PEER_LOCALMSPID=$Msp `
        CORE_PEER_ADDRESS="${fqdn}:${Port}" `
        CORE_PEER_MSPCONFIGPATH=$adminMsp `
        CORE_PEER_TLS_ENABLED=true `
        CORE_PEER_TLS_ROOTCERT_FILE=$tlsCa `
        peer channel join -b $Block 2>&1 | Select-Object -Last 2
}

$orgs = @(
    @{ Domain = "centralbank.gov"; Msp = "CentralBankMSP"; Base = 7051 },
    @{ Domain = "liquidity-bankA.com"; Msp = "LiquidityBankAMSP"; Base = 9051 },
    @{ Domain = "liquidity-bankB.com"; Msp = "LiquidityBankBMSP"; Base = 11051 }
)
foreach ($org in $orgs) {
    foreach ($idx in 0, 1, 2) {
        Join-Peer -Org $org.Domain -Msp $org.Msp -PeerIdx $idx -Port ($org.Base + $idx * 2)
    }
}

Write-Host "[tenderflow] Channel $ChannelId setup complete." -ForegroundColor Green
