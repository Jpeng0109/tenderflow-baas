package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type FxQuotationLedger struct {
	contractapi.Contract
}

type QuotationPayload struct {
	TxType           string  `json:"tx_type"`
	AssetPair        string  `json:"asset_pair"`
	SpotRate         float64 `json:"spot_rate"`
	QuoteProvider    string  `json:"quote_provider"`
	ZkTLSProofStatus string  `json:"zkTLS_proof_status"`
	ZkTLSProofHash   string  `json:"zkTLS_proof_hash,omitempty"`
	ComplianceTag    string  `json:"compliance_tag,omitempty"`
}

func (f *FxQuotationLedger) SubmitQuotation(ctx contractapi.TransactionContextInterface, payloadJSON string) error {
	var q QuotationPayload
	if err := json.Unmarshal([]byte(payloadJSON), &q); err != nil {
		return fmt.Errorf("invalid payload: %w", err)
	}
	if err := validateZkTLSProof(&q); err != nil {
		return fmt.Errorf("zkTLS verification failed: %w", err)
	}
	if q.TxType != "FX_QUOTATION_SUBMISSION" {
		return fmt.Errorf("unsupported tx_type: %s", q.TxType)
	}
	key := fmt.Sprintf("Quote:%s:%s", q.AssetPair, ctx.GetStub().GetTxID())
	return ctx.GetStub().PutState(key, []byte(payloadJSON))
}

func (f *FxQuotationLedger) VerifyZkTLSProof(ctx contractapi.TransactionContextInterface, payloadJSON string) (bool, error) {
	var q QuotationPayload
	if err := json.Unmarshal([]byte(payloadJSON), &q); err != nil {
		return false, err
	}
	return validateZkTLSProof(&q) == nil, nil
}

func validateZkTLSProof(q *QuotationPayload) error {
	status := strings.ToUpper(strings.TrimSpace(q.ZkTLSProofStatus))
	switch status {
	case "VERIFIED_SUCCESS", "VERIFIED":
		if len(q.ZkTLSProofHash) < 8 {
			return fmt.Errorf("zkTLS_proof_hash required when status is %s", status)
		}
		return nil
	case "PENDING_REVIEW":
		return fmt.Errorf("proof pending regulatory review")
	case "FAILED", "REJECTED":
		return fmt.Errorf("proof status %s", status)
	default:
		return fmt.Errorf("unknown zkTLS_proof_status: %s", q.ZkTLSProofStatus)
	}
}

func (f *FxQuotationLedger) GetQuotation(ctx contractapi.TransactionContextInterface, key string) (string, error) {
	b, err := ctx.GetStub().GetState(key)
	if err != nil || b == nil {
		return "", fmt.Errorf("quotation not found: %s", key)
	}
	return string(b), nil
}

func (f *FxQuotationLedger) QueryByAssetPair(ctx contractapi.TransactionContextInterface, assetPair string) ([]string, error) {
	iter, err := ctx.GetStub().GetStateByRange(fmt.Sprintf("Quote:%s:", assetPair), fmt.Sprintf("Quote:%s;", assetPair))
	if err != nil {
		return nil, err
	}
	defer iter.Close()
	var results []string
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, err
		}
		results = append(results, string(kv.Value))
	}
	return results, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&FxQuotationLedger{})
	if err != nil {
		panic(err.Error())
	}
	if err := chaincode.Start(); err != nil {
		panic(err.Error())
	}
}
