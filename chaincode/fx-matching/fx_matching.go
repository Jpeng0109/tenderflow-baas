package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// FxMatchingLedger — cross-border quote matching & settlement intent (Phase 2)
type FxMatchingLedger struct {
	contractapi.Contract
}

type MatchRequest struct {
	TxType        string  `json:"tx_type"`
	BuyAsset      string  `json:"buy_asset"`
	SellAsset     string  `json:"sell_asset"`
	Amount        float64 `json:"amount"`
	MaxSpotRate   float64 `json:"max_spot_rate"`
	RequestorMSP  string  `json:"requestor_msp"`
	SettlementRef string  `json:"settlement_ref"`
}

type MatchResult struct {
	MatchID       string  `json:"match_id"`
	Status        string  `json:"status"`
	MatchedRate   float64 `json:"matched_rate"`
	Counterparty  string  `json:"counterparty"`
	SettlementRef string  `json:"settlement_ref"`
	MatchedAt     string  `json:"matched_at"`
}

func (f *FxMatchingLedger) SubmitMatchRequest(ctx contractapi.TransactionContextInterface, payloadJSON string) error {
	var req MatchRequest
	if err := json.Unmarshal([]byte(payloadJSON), &req); err != nil {
		return fmt.Errorf("invalid match request: %w", err)
	}
	if req.TxType != "FX_MATCH_REQUEST" {
		return fmt.Errorf("unsupported tx_type: %s", req.TxType)
	}
	key := fmt.Sprintf("MatchRequest:%s", ctx.GetStub().GetTxID())
	return ctx.GetStub().PutState(key, []byte(payloadJSON))
}

func (f *FxMatchingLedger) ExecuteSettlement(ctx contractapi.TransactionContextInterface, matchID string, payloadJSON string) error {
	var result MatchResult
	if err := json.Unmarshal([]byte(payloadJSON), &result); err != nil {
		return fmt.Errorf("invalid settlement payload: %w", err)
	}
	result.MatchID = matchID
	result.Status = "SETTLED"
	result.MatchedAt = time.Now().UTC().Format(time.RFC3339)
	out, _ := json.Marshal(result)
	key := fmt.Sprintf("Settlement:%s", matchID)
	return ctx.GetStub().PutState(key, out)
}

func (f *FxMatchingLedger) GetSettlement(ctx contractapi.TransactionContextInterface, matchID string) (string, error) {
	b, err := ctx.GetStub().GetState(fmt.Sprintf("Settlement:%s", matchID))
	if err != nil || b == nil {
		return "", fmt.Errorf("settlement not found: %s", matchID)
	}
	return string(b), nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&FxMatchingLedger{})
	if err != nil {
		panic(err.Error())
	}
	if err := chaincode.Start(); err != nil {
		panic(err.Error())
	}
}
