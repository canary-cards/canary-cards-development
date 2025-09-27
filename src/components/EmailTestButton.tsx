import React from 'react';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const EmailTestButton = () => {
  const testEmailSend = async () => {
    try {
      // Test scenarios for different email types
      const testScenarios = [
        {
          name: "Complete Success",
          data: {
            representative: {
              name: "Doris Matsui",
              state: "CA", 
              party: "Democrat",
              type: "representative"
            },
            senators: [
              {"name": "Alex Padilla", "state": "CA", "party": "Democrat"},
              {"name": "Laphonza Butler", "state": "CA", "party": "Democrat"}
            ],
            sendOption: "triple",
            orderResults: [
              {"type": "representative", "recipient": "Doris Matsui", "orderId": "TEST-001", "status": "success"},
              {"type": "senator", "recipient": "Alex Padilla", "orderId": "TEST-002", "status": "success"},
              {"type": "senator", "recipient": "Laphonza Butler", "orderId": "TEST-003", "status": "success"}
            ],
            finalMessage: "Dear representative,\n\nI am writing to you as your constituent. I believe we need bold action on climate change and clean energy infrastructure.\n\nThank you for your consideration.\n\nSincerely,\n[Your Name]",
            summary: {
              totalSent: 3,
              totalFailed: 0,
              total: 3
            }
          }
        },
        {
          name: "Partial Failure",
          data: {
            representative: {
              name: "Doris Matsui",
              state: "CA",
              party: "Democrat", 
              type: "representative"
            },
            senators: [
              {"name": "Alex Padilla", "state": "CA", "party": "Democrat"},
              {"name": "Laphonza Butler", "state": "CA", "party": "Democrat"}
            ],
            sendOption: "triple",
            orderResults: [
              {"type": "representative", "recipient": "Doris Matsui", "orderId": "TEST-001", "status": "success"},
              {"type": "senator", "recipient": "Alex Padilla", "status": "error", "error": "Address validation failed"},
              {"type": "senator", "recipient": "Laphonza Butler", "orderId": "TEST-003", "status": "success"}
            ],
            finalMessage: "Dear representative,\n\nI am writing to you as your constituent about healthcare access in our community.\n\nThank you for your time.\n\nSincerely,\n[Your Name]",
            refundInfo: {
              refundAmountCents: 500,
              refundId: "REF-TEST-456", 
              totalAmountCents: 1200
            },
            summary: {
              totalSent: 2,
              totalFailed: 1,
              total: 3
            }
          }
        },
        {
          name: "Complete Failure",
          data: {
            representative: {
              name: "Doris Matsui",
              state: "CA",
              party: "Democrat",
              type: "representative"
            },
            senators: [
              {"name": "Alex Padilla", "state": "CA", "party": "Democrat"}
            ],
            sendOption: "double",
            orderResults: [
              {"type": "representative", "recipient": "Doris Matsui", "status": "error", "error": "Service temporarily unavailable"},
              {"type": "senator", "recipient": "Alex Padilla", "status": "error", "error": "Invalid address format"}
            ],
            finalMessage: "Dear representative,\n\nI am writing about education funding in our district.\n\nThank you.\n\nSincerely,\n[Your Name]",
            refundInfo: {
              refundAmountCents: 1000,
              refundId: "REF-TEST-789",
              totalAmountCents: 1000
            },
            summary: {
              totalSent: 0,
              totalFailed: 2,
              total: 2
            }
          }
        }
      ];

      const recipients = [
        {
          fullName: "Test User",
          email: "bwolfgang13@gmail.com", 
          streetAddress: "123 Main St",
          city: "Sacramento",
          state: "CA",
          zipCode: "95814"
        }
      ];

      console.log('Sending test emails for all scenarios...');
      
      const emailPromises = [];
      
      // Send one email for each scenario to the test recipient
      testScenarios.forEach((scenario, scenarioIndex) => {
        recipients.forEach((userInfo) => {
          const testData = { ...scenario.data, userInfo };
          console.log(`Sending ${scenario.name} test email to:`, userInfo.email);
          
          emailPromises.push(
            supabase.functions.invoke('send-order-confirmation', {
              body: testData
            }).then(result => ({ scenario: scenario.name, userInfo, result }))
          );
        });
      });

      const results = await Promise.all(emailPromises);
      
      let successCount = 0;
      let errorCount = 0;
      
      results.forEach(({ scenario, userInfo, result }) => {
        if (result.error) {
          console.error(`${scenario} email test error for ${userInfo.email}:`, result.error);
          errorCount++;
        } else {
          console.log(`${scenario} email test success for ${userInfo.email}:`, result.data);
          successCount++;
        }
      });

      if (errorCount === 0) {
        toast.success(`All ${results.length} test emails sent successfully!`);
      } else if (successCount > 0) {
        toast.success(`${successCount} test email(s) sent successfully, ${errorCount} failed`);
      } else {
        toast.error('All test emails failed to send');
      }
    } catch (error) {
      console.error('Email test exception:', error);
      toast.error('Failed to send test emails');
    }
  };

  return (
    <Button 
      onClick={testEmailSend}
      variant="outline"
      className="bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200"
    >
      🧪 Send Test Email
    </Button>
  );
};